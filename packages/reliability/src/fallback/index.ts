/**
 * Fallback eligibility is separate from retry eligibility.
 * A failure can be retried on the same provider and still be ineligible for
 * a second provider, or the reverse.
 *
 * Eligible: timeout, provider unavailable, provider rate limit, HTTP 429,
 * and selected HTTP 5xx responses.
 * Not eligible: authentication, invalid input, invalid output, configuration,
 * application quota, application budget, and the application rate limit.
 */
const FALLBACK_CODES = new Set([
  "ai_timeout",
  "ai_provider_unavailable",
  "ai_provider_rate_limit",
]);

const NEVER_FALLBACK_CODES = new Set([
  "ai_authentication",
  "ai_input_validation",
  "ai_output_validation",
  "ai_configuration",
  "ai_quota_exceeded",
  "ai_budget_exceeded",
  "ai_rate_limit_exceeded",
]);

function statusCodeOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const record = error as { statusCode?: unknown; cause?: unknown };
  if (typeof record.statusCode === "number") {
    return record.statusCode;
  }
  return statusCodeOf(record.cause);
}

export function isFallbackEligible(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && NEVER_FALLBACK_CODES.has(code)) {
    return false;
  }
  if (typeof code === "string" && FALLBACK_CODES.has(code)) {
    return true;
  }
  const status = statusCodeOf(error);
  return status === 429 || (status !== undefined && status >= 500);
}
