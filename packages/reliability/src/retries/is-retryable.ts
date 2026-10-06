const RETRYABLE_CODES = new Set([
  "ai_timeout",
  "ai_provider_rate_limit",
  "ai_provider_unavailable",
]);

const PERMANENT_CODES = new Set([
  "ai_authentication",
  "ai_input_validation",
  "ai_output_validation",
  "ai_configuration",
  "ai_quota_exceeded",
  "ai_budget_exceeded",
  "ai_rate_limit_exceeded",
]);

const TRANSIENT_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

type CodedError = {
  code?: unknown;
  cause?: unknown;
  statusCode?: unknown;
};

function asRecord(error: unknown): CodedError | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  return error as CodedError;
}

function statusCodeOf(error: unknown): number | undefined {
  const record = asRecord(error);
  if (record === undefined) {
    return undefined;
  }
  if (typeof record.statusCode === "number") {
    return record.statusCode;
  }
  return statusCodeOf(record.cause);
}

function networkCodeOf(error: unknown): string | undefined {
  const record = asRecord(error);
  if (record === undefined) {
    return undefined;
  }
  if (typeof record.code === "string" && TRANSIENT_NETWORK_CODES.has(record.code)) {
    return record.code;
  }
  return networkCodeOf(record.cause);
}

function isTransientCause(error: unknown): boolean {
  const status = statusCodeOf(error);
  if (status !== undefined) {
    return status === 429 || status >= 500;
  }
  return networkCodeOf(error) !== undefined;
}

export function isRetryable(error: unknown): boolean {
  const record = asRecord(error);
  const code = typeof record?.code === "string" ? record.code : undefined;
  if (code !== undefined && PERMANENT_CODES.has(code)) {
    return false;
  }
  if (code !== undefined && RETRYABLE_CODES.has(code)) {
    return true;
  }
  if (code === "ai_execution") {
    return isTransientCause(record?.cause);
  }
  return isTransientCause(error);
}
