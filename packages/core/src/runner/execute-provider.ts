import {
  isFallbackEligible,
  ProviderTimeoutError,
  withRetries,
  withTimeout,
  type RetryPolicy,
} from "@devstitch/reliability";
import { AIConfigurationError, AIError, AIProviderUnavailableError, AITimeoutError } from "../errors/ai-error.js";
import type {
  FeatureDefinition,
  NormalizedUsage,
  ProviderAdapter,
  ProviderAttemptRecord,
  ProviderAttemptStatus,
  StreamGenerationResult,
} from "../types/index.js";
import type { ResolvedModel } from "@devstitch/model-router";
import { routeModel } from "./route-model.js";
import { recordTelemetry, type TelemetryRecorder } from "./record-telemetry.js";
import type { ResolvedPrompt } from "./resolve-prompt.js";

export type ProviderMap = Record<string, ProviderAdapter>;

export type StructuredExecution = {
  data: unknown;
  usage: NormalizedUsage;
  finishReason: string;
  provider: string;
  model: string;
  attempts: number;
  providerAttempts: ProviderAttemptRecord[];
  fallbackUsed: boolean;
  timedOut: boolean;
};

type InvokeOptions<Output> = {
  feature: FeatureDefinition<unknown, Output>;
  prompt: ResolvedPrompt;
  timeoutMs: number;
  providers: ProviderMap;
  policy?: RetryPolicy;
  sleep?: (ms: number) => Promise<void>;
  simulatePrimaryFailure: boolean;
  telemetry?: TelemetryRecorder;
  runId: string;
  environment: string;
  models: import("@devstitch/model-router").ModelRegistry;
};

function shouldSimulate(explicit: boolean): boolean {
  return explicit || process.env.SIMULATE_PRIMARY_FAILURE === "true";
}

function statusOf(error: unknown): ProviderAttemptStatus {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === "ai_timeout") return "timeout";
  if (code === "ai_provider_unavailable") return "unavailable";
  if (code === "ai_provider_rate_limit") return "rate_limit";
  if (code === "ai_authentication") return "authentication";
  return "error";
}

function attemptCount(error: unknown): number {
  if (typeof error === "object" && error !== null && "attempts" in error) {
    const attempts = (error as { attempts?: unknown }).attempts;
    if (typeof attempts === "number") return attempts;
  }
  return 1;
}

function adapterFor(providers: ProviderMap, provider: string): ProviderAdapter {
  const adapter = providers[provider];
  if (adapter === undefined) {
    throw new AIConfigurationError(
      `No provider adapter is configured for "${provider}".`,
    );
  }
  return adapter;
}

function asTimeout(error: unknown): unknown {
  if (error instanceof ProviderTimeoutError) {
    return new AITimeoutError(error.message, { cause: error });
  }
  return error;
}

async function invokeStructured<Output>(
  target: ResolvedModel,
  isPrimary: boolean,
  options: InvokeOptions<Output>,
): Promise<{ data: Output; usage: NormalizedUsage; finishReason: string }> {
  if (isPrimary && shouldSimulate(options.simulatePrimaryFailure)) {
    throw new AIProviderUnavailableError(
      "SIMULATE_PRIMARY_FAILURE forced the primary provider to fail.",
    );
  }
  const adapter = adapterFor(options.providers, target.provider);
  try {
    const result = await withTimeout(options.timeoutMs, (signal) =>
      adapter.generateStructured({
        prompt: options.prompt.text,
        schema: options.feature.output,
        model: target.model,
        timeout: options.timeoutMs,
        abortSignal: signal,
      }),
    );
    return result as { data: Output; usage: NormalizedUsage; finishReason: string };
  } catch (error) {
    throw asTimeout(error);
  }
}

export async function executeProvider<Output>(
  primaryRef: string,
  options: InvokeOptions<Output>,
): Promise<StructuredExecution> {
  const resolvedPrimary = routeModel(primaryRef, options.environment, options.models);
  const providerAttempts: ProviderAttemptRecord[] = [];

  try {
    const primaryResult = await withRetries({
      policy: options.policy,
      sleep: options.sleep,
      run: () => invokeStructured(resolvedPrimary, true, options),
    });
    providerAttempts.push({ provider: resolvedPrimary.provider, status: "success" });
    return {
      data: primaryResult.value.data,
      usage: primaryResult.value.usage,
      finishReason: primaryResult.value.finishReason,
      provider: resolvedPrimary.provider,
      model: resolvedPrimary.model,
      attempts: primaryResult.attempts,
      providerAttempts,
      fallbackUsed: false,
      timedOut: false,
    };
  } catch (error) {
    providerAttempts.push({
      provider: resolvedPrimary.provider,
      status: statusOf(error),
    });
    recordTelemetry(options.telemetry, {
      type: "provider_failure",
      feature: options.feature.name,
      runId: options.runId,
      provider: resolvedPrimary.provider,
      errorName: error instanceof Error ? error.name : "Error",
      fallbackUsed: false,
    });

    const fallbackRef = options.feature.model.fallback;
    if (fallbackRef === undefined || !isFallbackEligible(error)) {
      throw error;
    }

    const fallback = routeModel(fallbackRef, options.environment, options.models);
    try {
      const fallbackResult = await withRetries({
        policy: options.policy,
        sleep: options.sleep,
        run: () => invokeStructured(fallback, false, options),
      });
      providerAttempts.push({ provider: fallback.provider, status: "success" });
      recordTelemetry(options.telemetry, {
        type: "provider_failure",
        feature: options.feature.name,
        runId: options.runId,
        provider: resolvedPrimary.provider,
        errorName: error instanceof Error ? error.name : "Error",
        fallbackUsed: true,
      });
      return {
        data: fallbackResult.value.data,
        usage: fallbackResult.value.usage,
        finishReason: fallbackResult.value.finishReason,
        provider: fallback.provider,
        model: fallback.model,
        attempts: attemptCount(error) + fallbackResult.attempts,
        providerAttempts,
        fallbackUsed: true,
        timedOut: false,
      };
    } catch (fallbackError) {
      providerAttempts.push({
        provider: fallback.provider,
        status: statusOf(fallbackError),
      });
      throw fallbackError;
    }
  }
}

export function openProviderStream(
  target: ResolvedModel,
  isPrimary: boolean,
  options: {
    prompt: ResolvedPrompt;
    timeoutMs: number;
    providers: ProviderMap;
    simulatePrimaryFailure: boolean;
  },
  signal: AbortSignal,
): StreamGenerationResult {
  if (isPrimary && shouldSimulate(options.simulatePrimaryFailure)) {
    throw new AIProviderUnavailableError(
      "SIMULATE_PRIMARY_FAILURE forced the primary provider to fail.",
    );
  }
  const adapter = adapterFor(options.providers, target.provider);
  return adapter.generateStream({
    prompt: options.prompt.text,
    model: target.model,
    timeout: options.timeoutMs,
    abortSignal: signal,
  });
}

export function throwWithMeta(error: unknown, meta: import("../types/index.js").RunResultMeta): never {
  const normalized =
    error instanceof ProviderTimeoutError
      ? new AITimeoutError(error.message, { cause: error })
      : error;
  if (normalized instanceof AIError) {
    normalized.runMeta = meta;
  }
  throw normalized;
}
