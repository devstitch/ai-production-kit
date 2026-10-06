import type { ZodSchema } from "zod";

export type RetryBackoff = "exponential" | "fixed";

export type RetryPolicy = {
  attempts: number;
  backoff: RetryBackoff;
  maxDelayMs: number;
};

export type FeatureQuota = {
  perUser?: string;
  perOrganization?: string;
  /** Feature-wide request cap, such as "500/month". The feature name is `name`, not this string. */
  feature?: string;
};

export type FeatureBudget = {
  maxCostPerRun?: number;
  /** Estimated spend for this feature and organization over 30 days. */
  monthly?: number;
  /** Estimated spend for the organization over 30 days. */
  organizationMonthly?: number;
};

export type FeatureTelemetry = {
  recordContent?: boolean;
};

export type FeaturePrivacy = {
  redact?: string[];
};

export type FeaturePromptRef = {
  id: string;
  version: string;
};

export type FeatureModelRef = {
  primary: string;
  fallback?: string;
};

export type FeatureRateLimit = {
  limit: number;
  windowSeconds: number;
};

export type FeatureDefinition<Input, Output> = {
  name: string;
  description?: string;
  input: ZodSchema<Input>;
  output: ZodSchema<Output>;
  prompt: FeaturePromptRef;
  model: FeatureModelRef;
  timeout?: number;
  retries?: RetryPolicy;
  quota?: FeatureQuota;
  budget?: FeatureBudget;
  rateLimit?: FeatureRateLimit;
  telemetry?: FeatureTelemetry;
  privacy?: FeaturePrivacy;
};

export type RunContext = {
  userId: string;
  organizationId: string;
  requestId?: string;
  environment?: string;
  featureFlags?: Readonly<Record<string, boolean>>;
};

export type ProviderAttemptStatus =
  | "success"
  | "timeout"
  | "unavailable"
  | "rate_limit"
  | "authentication"
  | "error";

export type ProviderAttemptRecord = {
  provider: string;
  status: ProviderAttemptStatus;
};

export type RunResultMeta = {
  runId: string;
  feature: string;
  provider: string;
  model: string;
  promptVersion: string;
  /** SHA-256 of the prompt render function that produced this run. */
  promptHash: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  latencyMs: number;
  /** Provider calls made for this run, including the successful call. */
  attempts: number;
  /**
   * One entry per provider that was tried. Prompt 9 describes this list as
   * `attempts`; that name is already the call count above.
   */
  providerAttempts: ProviderAttemptRecord[];
  fallbackUsed: boolean;
  timedOut: boolean;
  finishReason?: string;
  timeToFirstTokenMs?: number;
};

export type RunResult<Output> = {
  data: Output;
  meta: RunResultMeta;
};

export type {
  NormalizedUsage,
  ProviderAdapter,
  StreamCompletion,
  StreamGenerationRequest,
  StreamGenerationResult,
  StructuredGenerationRequest,
  StructuredGenerationResult,
} from "./provider.js";
