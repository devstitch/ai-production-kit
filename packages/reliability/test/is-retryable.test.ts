import assert from "node:assert/strict";
import { test } from "node:test";
import { isRetryable } from "../dist/retries/is-retryable.js";
import { isFallbackEligible } from "../dist/fallback/index.js";

test("authentication and schema errors are not retryable", () => {
  assert.equal(isRetryable({ code: "ai_authentication" }), false);
  assert.equal(isRetryable({ code: "ai_input_validation" }), false);
  assert.equal(isRetryable({ code: "ai_output_validation" }), false);
  assert.equal(isRetryable({ code: "ai_configuration" }), false);
});

test("timeouts, provider rate limits, and 5xx responses are retryable", () => {
  assert.equal(isRetryable({ code: "ai_timeout" }), true);
  assert.equal(isRetryable({ code: "ai_provider_rate_limit" }), true);
  assert.equal(isRetryable({ code: "ai_execution", cause: { statusCode: 503 } }), true);
  assert.equal(isRetryable({ code: "ECONNRESET" }), true);
});

test("fallback eligibility is explicit and excludes authentication", () => {
  assert.equal(isFallbackEligible({ code: "ai_timeout" }), true);
  assert.equal(isFallbackEligible({ code: "ai_provider_unavailable" }), true);
  assert.equal(isFallbackEligible({ code: "ai_authentication" }), false);
  assert.equal(isFallbackEligible({ statusCode: 500 }), true);
  assert.equal(isFallbackEligible({ code: "ai_input_validation" }), false);
});
