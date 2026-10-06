import {
  DEFAULT_RATE_LIMIT,
  type RateLimiter,
} from "@devstitch/policies";
import { AIRateLimitExceededError } from "../errors/ai-error.js";
import type { FeatureDefinition, RunContext } from "../types/index.js";

export function rateLimitKey(featureName: string, context: RunContext): string {
  return `${context.userId}:${context.organizationId}:${featureName}`;
}

export async function checkRateLimit<Input, Output>(
  feature: FeatureDefinition<Input, Output>,
  context: RunContext,
  rateLimiter: RateLimiter,
): Promise<void> {
  const limit = feature.rateLimit ?? DEFAULT_RATE_LIMIT;
  const decision = await rateLimiter.check(
    rateLimitKey(feature.name, context),
    limit.limit,
    limit.windowSeconds,
  );
  if (!decision.allowed) {
    throw new AIRateLimitExceededError(
      `Feature "${feature.name}" exceeded its rate limit.`,
      { retryAfterSeconds: decision.retryAfterSeconds },
    );
  }
}
