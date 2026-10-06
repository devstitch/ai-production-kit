import assert from "node:assert/strict";
import { test } from "node:test";
import { AIExecutionError } from "@devstitch/core";
import { normalizeUsage } from "../dist/normalize-usage.js";

test("normalizeUsage maps input, output, and total tokens", () => {
  const usage = normalizeUsage({
    inputTokens: 10,
    outputTokens: 4,
    totalTokens: 14,
  });

  assert.deepEqual(usage, {
    inputTokens: 10,
    outputTokens: 4,
    totalTokens: 14,
  });
  assert.equal("cachedInputTokens" in usage, false);
  assert.equal("cacheWriteTokens" in usage, false);
});

test("normalizeUsage keeps cache fields only when the provider reports them", () => {
  const usage = normalizeUsage({
    inputTokens: 10,
    outputTokens: 4,
    totalTokens: 14,
    inputTokenDetails: {
      cacheReadTokens: 3,
      cacheWriteTokens: 2,
    },
  });

  assert.equal(usage.cachedInputTokens, 3);
  assert.equal(usage.cacheWriteTokens, 2);
});

test("normalizeUsage sums total tokens when the provider omits the total", () => {
  const usage = normalizeUsage({
    inputTokens: 8,
    outputTokens: 2,
  });

  assert.equal(usage.totalTokens, 10);
});

test("normalizeUsage rejects a report that is missing token counts", () => {
  assert.throws(
    () => normalizeUsage({ outputTokens: 2 }),
    AIExecutionError,
  );
});
