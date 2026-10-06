import type { UsageStore, UsageWindow } from "../store/types.js";

export type QuotaUnit = "requests" | "tokens" | "cost";

export type ParsedQuota = {
  limit: number;
  windowSeconds: number;
  unit: QuotaUnit;
};

export type QuotaConfig = {
  perUser?: string;
  perOrganization?: string;
  /** Feature-wide request cap, for example "500/month" on the invoice-extraction feature. */
  feature?: string;
};

export class QuotaConfigError extends Error {
  readonly code = "ai_configuration" as const;

  constructor(message: string) {
    super(message);
    this.name = "QuotaConfigError";
  }
}

export type QuotaDecision =
  | { exceeded: false }
  | { exceeded: true; scope: "user" | "organization" | "feature"; limit: number };

const DAY_SECONDS = 86_400;
const MONTH_SECONDS = 30 * DAY_SECONDS;

/**
 * Parses "100/day" or "5000/month". A month is 30 days so the result is a
 * fixed window in seconds. Only the "requests" unit is enforced. "tokens" and
 * "cost" are part of the type so a later version can add them without
 * changing this shape, and they fail loudly until then.
 */
export function parseQuota(shorthand: string, unit: QuotaUnit = "requests"): ParsedQuota {
  if (unit !== "requests") {
    throw new QuotaConfigError(
      `Quota unit "${unit}" is not implemented. Only "requests" is enforced.`,
    );
  }
  const match = /^(\d+)\/(day|month)$/.exec(shorthand.trim());
  if (match === null) {
    throw new QuotaConfigError(
      `Quota "${shorthand}" must look like "100/day" or "5000/month".`,
    );
  }
  return {
    limit: Number(match[1]),
    windowSeconds: match[2] === "day" ? DAY_SECONDS : MONTH_SECONDS,
    unit,
  };
}

export function quotaWindow(parsed: ParsedQuota, now: Date, feature?: string): UsageWindow {
  return {
    start: new Date(now.getTime() - parsed.windowSeconds * 1000),
    end: now,
    ...(feature === undefined ? {} : { feature }),
  };
}

export async function evaluateQuota(input: {
  quota: QuotaConfig | undefined;
  feature: string;
  userId: string;
  organizationId: string;
  store: UsageStore;
  now?: Date;
}): Promise<QuotaDecision> {
  if (input.quota === undefined) return { exceeded: false };
  const now = input.now ?? new Date();
  const checks: Array<{ scope: "user" | "organization" | "feature"; shorthand: string | undefined }> =
    [
      { scope: "user", shorthand: input.quota.perUser },
      { scope: "organization", shorthand: input.quota.perOrganization },
      { scope: "feature", shorthand: input.quota.feature },
    ];

  for (const check of checks) {
    if (check.shorthand === undefined) continue;
    const parsed = parseQuota(check.shorthand);
    const window = quotaWindow(parsed, now, input.feature);
    const usage =
      check.scope === "user"
        ? await input.store.getUserUsage(input.userId, input.organizationId, window)
        : check.scope === "organization"
          ? await input.store.getOrganizationUsage(input.organizationId, window)
          : await input.store.getFeatureUsage(input.feature, input.organizationId, window);
    if (usage.requests >= parsed.limit) {
      return { exceeded: true, scope: check.scope, limit: parsed.limit };
    }
  }
  return { exceeded: false };
}
