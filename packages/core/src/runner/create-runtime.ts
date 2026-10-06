import { randomUUID } from "node:crypto";
import { ModelRegistry } from "@devstitch/model-router";
import { MemoryRateLimiter, type PolicyHooks, type RateLimiter } from "@devstitch/policies";
import { builtinPrompts, type PromptRegistry } from "@devstitch/prompts";
import { DEFAULT_TIMEOUT_MS, ProviderTimeoutError } from "@devstitch/reliability";
import {
  createExamplePricing,
  createUsageRecord,
  MemoryUsageStore,
  type NormalizedUsageRecord,
  type PricingRegistry,
  type StoredRun,
  type UsageStore,
} from "@devstitch/usage";
import { AIError, AITimeoutError } from "../errors/ai-error.js";
import type {
  FeatureDefinition,
  NormalizedUsage,
  RunContext,
  RunResult,
  RunResultMeta,
  StreamGenerationResult,
} from "../types/index.js";
import { estimateRunCost } from "./account-usage.js";
import { attachContext, resolveEnvironment } from "./attach-context.js";
import { checkBudget, checkQuota } from "./check-allowance.js";
import { checkRateLimit } from "./check-rate-limit.js";
import {
  executeProvider,
  openProviderStream,
  throwWithMeta,
  type ProviderMap,
} from "./execute-provider.js";
import {
  applyRedaction,
  recordTelemetry,
  type TelemetryAttributes,
  type TelemetryRecorder,
} from "./record-telemetry.js";
import { resolvePrompt, type ResolvedPrompt } from "./resolve-prompt.js";
import { routeModel } from "./route-model.js";
import { validateInput } from "./validate-input.js";

export type { UsageStore };

export type AIRuntimeOptions = {
  providers: ProviderMap;
  models?: ModelRegistry;
  telemetry?: TelemetryRecorder;
  usageStore?: UsageStore;
  rateLimiter?: RateLimiter;
  pricing?: PricingRegistry;
  prompts?: PromptRegistry;
  hooks?: PolicyHooks;
  beforeTelemetryRecord?: (attributes: TelemetryAttributes) => TelemetryAttributes;
  simulatePrimaryFailure?: boolean;
  sleep?: (ms: number) => Promise<void>;
};

export type StreamRun = AsyncIterable<string> & {
  meta: Promise<RunResultMeta>;
};

type RunRequest<Input> = {
  input: Input;
  context: RunContext;
};

type Prepared<Input> = {
  input: Input;
  context: RunContext;
  prompt: ResolvedPrompt;
  environment: string;
  runId: string;
  started: number;
};

function describeModel(ref: string): { provider: string; model: string } {
  const index = ref.indexOf(":");
  if (index === -1) return { provider: ref, model: ref };
  return { provider: ref.slice(0, index), model: ref.slice(index + 1) };
}

export function createAIRuntime(options: AIRuntimeOptions) {
  const models = options.models ?? new ModelRegistry();
  const rateLimiter = options.rateLimiter ?? new MemoryRateLimiter();
  const pricing = options.pricing ?? createExamplePricing();
  const prompts = options.prompts ?? builtinPrompts;
  const usageStore = options.usageStore ?? new MemoryUsageStore();
  const hooks = options.hooks ?? {};

  function hookContext(runId: string, feature: string, context: RunContext) {
    return {
      runId,
      feature,
      userId: context.userId,
      organizationId: context.organizationId,
    };
  }

  async function prepare<Input, Output>(
    feature: FeatureDefinition<Input, Output>,
    request: RunRequest<Input>,
  ): Promise<Prepared<Input>> {
    const input = validateInput(feature, request.input);
    const context = attachContext(request.context);
    const runId = randomUUID();
    await hooks.beforeRun?.(hookContext(runId, feature.name, context));
    await checkRateLimit(feature, context, rateLimiter);
    await checkQuota(feature, context, usageStore);
    await checkBudget(feature, context, usageStore);
    const prompt = resolvePrompt(feature, input, prompts);
    const environment = resolveEnvironment(context);
    return { input, context, prompt, environment, runId, started: Date.now() };
  }

  function emit<Input, Output>(
    feature: FeatureDefinition<Input, Output>,
    event: {
      type: "run" | "provider_failure";
      runId: string;
      provider?: string;
      errorName?: string;
      fallbackUsed?: boolean;
      attributes: TelemetryAttributes;
      promptText?: string;
      outputText?: string;
    },
  ) {
    const attributes = { ...event.attributes };
    if (feature.telemetry?.recordContent === true) {
      if (event.promptText !== undefined) attributes["ai.prompt.text"] = event.promptText;
      if (event.outputText !== undefined) attributes["ai.output.text"] = event.outputText;
    }
    recordTelemetry(options.telemetry, {
      type: event.type,
      feature: feature.name,
      runId: event.runId,
      provider: event.provider,
      errorName: event.errorName,
      fallbackUsed: event.fallbackUsed,
      attributes: applyRedaction(attributes, feature.privacy?.redact, options.beforeTelemetryRecord),
    });
  }

  function metaFrom(input: {
    prepared: Prepared<unknown>;
    feature: string;
    provider: string;
    model: string;
    attempts: number;
    providerAttempts: RunResultMeta["providerAttempts"];
    fallbackUsed: boolean;
    timedOut: boolean;
    usage: NormalizedUsage;
    finishReason?: string;
    timeToFirstTokenMs?: number;
    estimatedCost: number;
  }): RunResultMeta {
    return {
      runId: input.prepared.runId,
      feature: input.feature,
      provider: input.provider,
      model: input.model,
      promptVersion: input.prepared.prompt.version,
      promptHash: input.prepared.prompt.hash,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      estimatedCost: input.estimatedCost,
      latencyMs: Date.now() - input.prepared.started,
      attempts: input.attempts,
      providerAttempts: input.providerAttempts,
      fallbackUsed: input.fallbackUsed,
      timedOut: input.timedOut,
      ...(input.finishReason === undefined ? {} : { finishReason: input.finishReason }),
      ...(input.timeToFirstTokenMs === undefined
        ? {}
        : { timeToFirstTokenMs: input.timeToFirstTokenMs }),
    };
  }

  async function persist(
    prepared: Prepared<unknown>,
    meta: RunResultMeta,
    status: StoredRun["status"],
    errorType?: string,
  ) {
    const row: StoredRun = {
      id: meta.runId,
      featureName: meta.feature,
      userId: prepared.context.userId,
      organizationId: prepared.context.organizationId,
      provider: meta.provider,
      model: meta.model,
      promptId: prepared.prompt.id,
      promptVersion: meta.promptVersion,
      promptHash: meta.promptHash,
      status,
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      estimatedCost: meta.estimatedCost,
      latencyMs: meta.latencyMs,
      retryCount: Math.max(0, meta.attempts - 1),
      fallbackUsed: meta.fallbackUsed,
      traceId: meta.runId,
      createdAt: new Date(),
      ...(meta.timeToFirstTokenMs === undefined
        ? {}
        : { timeToFirstTokenMs: meta.timeToFirstTokenMs }),
      ...(errorType === undefined ? {} : { errorType }),
    };
    await usageStore.record(row);
  }

  function usageRecord(
    prepared: Prepared<unknown>,
    feature: string,
    provider: string,
    model: string,
    usage: NormalizedUsage,
  ): NormalizedUsageRecord {
    return createUsageRecord({
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      ...(usage.cachedInputTokens === undefined
        ? {}
        : { cachedInputTokens: usage.cachedInputTokens }),
      ...(usage.cacheWriteTokens === undefined ? {} : { cacheWriteTokens: usage.cacheWriteTokens }),
      provider,
      model,
      feature,
      userId: prepared.context.userId,
      organizationId: prepared.context.organizationId,
      timestamp: new Date(),
    });
  }

  function spanAttributes(input: {
    prepared: Prepared<unknown>;
    feature: string;
    provider: string;
    model: string;
    attempts: number;
    fallbackUsed: boolean;
    estimatedCost: number;
    usage: NormalizedUsage;
  }): TelemetryAttributes {
    return {
      "gen_ai.provider.name": input.provider,
      "gen_ai.request.model": input.model,
      "gen_ai.client.token.usage": input.usage.inputTokens + input.usage.outputTokens,
      "gen_ai.client.operation.duration": Date.now() - input.prepared.started,
      "ai.feature.name": input.feature,
      "ai.run.id": input.prepared.runId,
      "ai.prompt.id": input.prepared.prompt.id,
      "ai.prompt.version": input.prepared.prompt.version,
      "ai.user.id": input.prepared.context.userId,
      "ai.organization.id": input.prepared.context.organizationId,
      "ai.retry.count": Math.max(0, input.attempts - 1),
      "ai.fallback.used": input.fallbackUsed,
      "ai.cost.estimated": input.estimatedCost,
    };
  }

  async function run<Input, Output>(
    feature: FeatureDefinition<Input, Output>,
    request: RunRequest<Input>,
  ): Promise<RunResult<Output>> {
    const prepared = await prepare(feature, request);
    const timeoutMs = feature.timeout ?? DEFAULT_TIMEOUT_MS;
    const primary = routeModel(feature.model.primary, prepared.environment, models);
    try {
      await hooks.beforeProviderCall?.({
        ...hookContext(prepared.runId, feature.name, prepared.context),
        provider: primary.provider,
        model: primary.model,
      });
      const execution = await executeProvider(feature.model.primary, {
        feature,
        prompt: prepared.prompt,
        timeoutMs,
        providers: options.providers,
        policy: feature.retries,
        sleep: options.sleep,
        simulatePrimaryFailure: options.simulatePrimaryFailure ?? false,
        telemetry: options.telemetry,
        runId: prepared.runId,
        environment: prepared.environment,
        models,
      });
      const record = usageRecord(
        prepared,
        feature.name,
        execution.provider,
        execution.model,
        execution.usage,
      );
      await hooks.afterProviderCall?.({
        ...hookContext(prepared.runId, feature.name, prepared.context),
        usage: record,
      });
      const estimatedCost = estimateRunCost(pricing, record);
      const meta = metaFrom({
        prepared,
        feature: feature.name,
        provider: execution.provider,
        model: execution.model,
        attempts: execution.attempts,
        providerAttempts: execution.providerAttempts,
        fallbackUsed: execution.fallbackUsed,
        timedOut: execution.timedOut,
        usage: execution.usage,
        finishReason: execution.finishReason,
        estimatedCost,
      });
      emit(feature, {
        type: "run",
        runId: prepared.runId,
        provider: execution.provider,
        fallbackUsed: execution.fallbackUsed,
        attributes: spanAttributes({
          prepared,
          feature: feature.name,
          provider: execution.provider,
          model: execution.model,
          attempts: execution.attempts,
          fallbackUsed: execution.fallbackUsed,
          estimatedCost,
          usage: execution.usage,
        }),
        promptText: prepared.prompt.text,
        outputText: JSON.stringify(execution.data),
      });
      await persist(prepared, meta, "success");
      await hooks.afterRun?.(hookContext(prepared.runId, feature.name, prepared.context));
      return { data: execution.data as Output, meta };
    } catch (error) {
      const attempts =
        typeof error === "object" &&
        error !== null &&
        "attempts" in error &&
        typeof (error as { attempts?: unknown }).attempts === "number"
          ? (error as { attempts: number }).attempts
          : 1;
      const described = describeModel(feature.model.primary);
      const meta = metaFrom({
        prepared,
        feature: feature.name,
        provider: described.provider,
        model: described.model,
        attempts,
        providerAttempts: [],
        fallbackUsed: false,
        timedOut: error instanceof AITimeoutError || error instanceof ProviderTimeoutError,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        estimatedCost: 0,
      });
      emit(feature, {
        type: "run",
        runId: prepared.runId,
        provider: described.provider,
        errorName: error instanceof Error ? error.name : "Error",
        fallbackUsed: false,
        attributes: spanAttributes({
          prepared,
          feature: feature.name,
          provider: described.provider,
          model: described.model,
          attempts,
          fallbackUsed: false,
          estimatedCost: 0,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        }),
        promptText: prepared.prompt.text,
      });
      await persist(
        prepared,
        meta,
        "failure",
        error instanceof AIError ? error.code : error instanceof Error ? error.name : "Error",
      );
      await hooks.onError?.({
        ...hookContext(prepared.runId, feature.name, prepared.context),
        error,
      });
      throwWithMeta(error, meta);
    }
  }

  async function stream<Input, Output>(
    feature: FeatureDefinition<Input, Output>,
    request: RunRequest<Input>,
  ): Promise<StreamRun> {
    const prepared = await prepare(feature, request);
    const timeoutMs = feature.timeout ?? DEFAULT_TIMEOUT_MS;
    const target = routeModel(feature.model.primary, prepared.environment, models);
    await hooks.beforeProviderCall?.({
      ...hookContext(prepared.runId, feature.name, prepared.context),
      provider: target.provider,
      model: target.model,
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let opened: StreamGenerationResult;
    try {
      opened = openProviderStream(
        target,
        true,
        {
          prompt: prepared.prompt,
          timeoutMs,
          providers: options.providers,
          simulatePrimaryFailure: options.simulatePrimaryFailure ?? false,
        },
        controller.signal,
      );
    } catch (error) {
      clearTimeout(timer);
      const meta = metaFrom({
        prepared,
        feature: feature.name,
        provider: target.provider,
        model: target.model,
        attempts: 1,
        providerAttempts: [{ provider: target.provider, status: "error" }],
        fallbackUsed: false,
        timedOut: false,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        estimatedCost: 0,
      });
      await persist(
        prepared,
        meta,
        "failure",
        error instanceof AIError ? error.code : error instanceof Error ? error.name : "Error",
      );
      throw error;
    }

    let resolveMeta: (meta: RunResultMeta) => void = () => undefined;
    let rejectMeta: (error: unknown) => void = () => undefined;
    const meta = new Promise<RunResultMeta>((resolve, reject) => {
      resolveMeta = resolve;
      rejectMeta = reject;
    });

    const iterable: StreamRun = {
      meta,
      async *[Symbol.asyncIterator]() {
        let firstChunkAt: number | undefined;
        let text = "";
        try {
          for await (const chunk of opened.stream) {
            if (controller.signal.aborted) {
              throw new ProviderTimeoutError();
            }
            if (firstChunkAt === undefined) {
              firstChunkAt = Date.now();
            }
            text += chunk;
            yield chunk;
          }
          const completion = await opened.completion;
          const record = usageRecord(
            prepared,
            feature.name,
            target.provider,
            target.model,
            completion.usage,
          );
          await hooks.afterProviderCall?.({
            ...hookContext(prepared.runId, feature.name, prepared.context),
            usage: record,
          });
          const estimatedCost = estimateRunCost(pricing, record);
          const result = metaFrom({
            prepared,
            feature: feature.name,
            provider: target.provider,
            model: target.model,
            attempts: 1,
            providerAttempts: [{ provider: target.provider, status: "success" }],
            fallbackUsed: false,
            timedOut: false,
            usage: completion.usage,
            finishReason: completion.finishReason,
            timeToFirstTokenMs:
              firstChunkAt === undefined ? undefined : firstChunkAt - prepared.started,
            estimatedCost,
          });
          emit(feature, {
            type: "run",
            runId: prepared.runId,
            provider: target.provider,
            attributes: spanAttributes({
              prepared,
              feature: feature.name,
              provider: target.provider,
              model: target.model,
              attempts: 1,
              fallbackUsed: false,
              estimatedCost,
              usage: completion.usage,
            }),
            promptText: prepared.prompt.text,
            outputText: text,
          });
          await persist(prepared, result, "success");
          await hooks.afterRun?.(hookContext(prepared.runId, feature.name, prepared.context));
          resolveMeta(result);
        } catch (error) {
          const timedOut = controller.signal.aborted || error instanceof ProviderTimeoutError;
          const metaResult = metaFrom({
            prepared,
            feature: feature.name,
            provider: target.provider,
            model: target.model,
            attempts: 1,
            providerAttempts: [
              { provider: target.provider, status: timedOut ? "timeout" : "error" },
            ],
            fallbackUsed: false,
            timedOut,
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            estimatedCost: 0,
          });
          const thrown = timedOut
            ? new AITimeoutError("The provider call exceeded the configured timeout.", {
                cause: error,
              })
            : error;
          if (thrown instanceof AIError) {
            thrown.runMeta = metaResult;
          }
          await persist(
            prepared,
            metaResult,
            "failure",
            thrown instanceof AIError ? thrown.code : thrown instanceof Error ? thrown.name : "Error",
          );
          rejectMeta(thrown);
          throw thrown;
        } finally {
          clearTimeout(timer);
        }
      },
    };

    return iterable;
  }

  return { run, stream };
}
