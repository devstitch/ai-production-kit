import {
  evaluateBudget,
  evaluateQuota,
  QuotaConfigError,
  type UsageStore,
} from "@devstitch/usage";
import {
  AIBudgetExceededError,
  AIConfigurationError,
  AIQuotaExceededError,
} from "../errors/ai-error.js";
import type { FeatureDefinition, RunContext } from "../types/index.js";

export async function checkQuota<Input, Output>(
  feature: FeatureDefinition<Input, Output>,
  context: RunContext,
  store: UsageStore,
  now: Date = new Date(),
): Promise<void> {
  let decision;
  try {
    decision = await evaluateQuota({
      quota: feature.quota,
      feature: feature.name,
      userId: context.userId,
      organizationId: context.organizationId,
      store,
      now,
    });
  } catch (error) {
    if (error instanceof QuotaConfigError) {
      throw new AIConfigurationError(error.message, { cause: error });
    }
    throw error;
  }
  if (decision.exceeded) {
    throw new AIQuotaExceededError(
      `${decision.scope} quota exceeded for "${feature.name}". Limit is ${decision.limit} requests.`,
    );
  }
}

export async function checkBudget<Input, Output>(
  feature: FeatureDefinition<Input, Output>,
  context: RunContext,
  store: UsageStore,
  now: Date = new Date(),
): Promise<void> {
  const decision = await evaluateBudget({
    budget: feature.budget,
    feature: feature.name,
    organizationId: context.organizationId,
    store,
    now,
  });
  if (decision.exceeded) {
    throw new AIBudgetExceededError(
      `${decision.scope} budget exceeded for "${feature.name}". Spent ${decision.spent} of ${decision.limit}.`,
    );
  }
}
