import type { UsageStore } from "../store/types.js";

export type BudgetConfig = {
  /**
   * Soft pre-call cap. The exact cost is not known until the provider responds.
   * When this feature already has recorded runs for the organization, their
   * average estimated cost is compared with this cap. With no history, the
   * pre-check is skipped.
   */
  maxCostPerRun?: number;
  /** Accumulated estimated spend for this feature and organization over 30 days. */
  monthly?: number;
  /** Accumulated estimated spend for the organization over 30 days, across features. */
  organizationMonthly?: number;
};

export type BudgetDecision =
  | { exceeded: false }
  | {
      exceeded: true;
      scope: "run" | "feature" | "organization";
      limit: number;
      spent: number;
    };

const MONTH_MS = 30 * 86_400 * 1000;

function monthWindow(now: Date, feature?: string) {
  return {
    start: new Date(now.getTime() - MONTH_MS),
    end: now,
    ...(feature === undefined ? {} : { feature }),
  };
}

/**
 * Pre-call budget check.
 *
 * maxCostPerRun cannot be calculated exactly before the provider call. This
 * uses the average estimated cost of runs already stored for the feature and
 * organization. If that average is missing, the run is allowed. Monthly caps
 * use accumulated estimated cost and block before the provider is called.
 */
export async function evaluateBudget(input: {
  budget: BudgetConfig | undefined;
  feature: string;
  organizationId: string;
  store: UsageStore;
  now?: Date;
}): Promise<BudgetDecision> {
  if (input.budget === undefined) return { exceeded: false };
  const now = input.now ?? new Date();
  const featureUsage = await input.store.getFeatureUsage(
    input.feature,
    input.organizationId,
    monthWindow(now, input.feature),
  );

  if (input.budget.maxCostPerRun !== undefined && featureUsage.requests > 0) {
    const typical = featureUsage.estimatedCost / featureUsage.requests;
    if (typical >= input.budget.maxCostPerRun) {
      return {
        exceeded: true,
        scope: "run",
        limit: input.budget.maxCostPerRun,
        spent: typical,
      };
    }
  }

  if (input.budget.monthly !== undefined && featureUsage.estimatedCost >= input.budget.monthly) {
    return {
      exceeded: true,
      scope: "feature",
      limit: input.budget.monthly,
      spent: featureUsage.estimatedCost,
    };
  }

  if (input.budget.organizationMonthly !== undefined) {
    const organization = await input.store.getOrganizationUsage(
      input.organizationId,
      monthWindow(now),
    );
    if (organization.estimatedCost >= input.budget.organizationMonthly) {
      return {
        exceeded: true,
        scope: "organization",
        limit: input.budget.organizationMonthly,
        spent: organization.estimatedCost,
      };
    }
  }

  return { exceeded: false };
}
