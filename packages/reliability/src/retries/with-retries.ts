import { isRetryable } from "./is-retryable.js";

export type RetryPolicy = {
  attempts: number;
  backoff: "exponential" | "fixed";
  maxDelayMs: number;
};

export function retryDelayMs(policy: RetryPolicy, retryIndex: number): number {
  if (policy.backoff === "fixed") {
    return policy.maxDelayMs;
  }
  const exponential = Math.min(policy.maxDelayMs, 50 * 2 ** retryIndex);
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exponential * 0.25)));
  return Math.min(policy.maxDelayMs, exponential + jitter);
}

export async function withRetries<T>(options: {
  policy?: RetryPolicy;
  sleep?: (ms: number) => Promise<void>;
  run: () => Promise<T>;
}): Promise<{ value: T; attempts: number }> {
  const extraAttempts = options.policy?.attempts ?? 0;
  const maxTries = 1 + extraAttempts;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  for (let attempt = 1; attempt <= maxTries; attempt += 1) {
    try {
      return { value: await options.run(), attempts: attempt };
    } catch (error) {
      const canRetry = attempt < maxTries && isRetryable(error);
      if (!canRetry) {
        if (typeof error === "object" && error !== null) {
          Object.defineProperty(error, "attempts", {
            value: attempt,
            enumerable: false,
          });
        }
        throw error;
      }
      if (options.policy !== undefined) {
        await sleep(retryDelayMs(options.policy, attempt - 1));
      }
    }
  }

  throw new Error("Retry loop ended without a result.");
}
