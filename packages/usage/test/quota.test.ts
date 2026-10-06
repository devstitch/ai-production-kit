import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateQuota, MemoryUsageStore, parseQuota, QuotaConfigError } from "../dist/index.js";
import type { StoredRun } from "../dist/index.js";

test("day and month shorthands become a request window", () => {
  assert.deepEqual(parseQuota("100/day"), {
    limit: 100,
    windowSeconds: 86_400,
    unit: "requests",
  });
  assert.equal(parseQuota("5000/month").windowSeconds, 30 * 86_400);
});

test("token and cost units are rejected until they are implemented", () => {
  assert.throws(() => parseQuota("10/day", "tokens"), QuotaConfigError);
});

test("a malformed quota string is rejected", () => {
  assert.throws(() => parseQuota("lots"), QuotaConfigError);
});

test("evaluateQuota blocks when the stored request count reaches the limit", async () => {
  const store = new MemoryUsageStore();
  await store.record(sample("user-1", "org-1"));
  const decision = await evaluateQuota({
    quota: { perUser: "1/day" },
    feature: "support-ticket-triage",
    userId: "user-1",
    organizationId: "org-1",
    store,
    now: new Date("2026-06-02T00:00:00Z"),
  });
  assert.deepEqual(decision, { exceeded: true, scope: "user", limit: 1 });
});

function sample(userId: string, organizationId: string): StoredRun {
  return {
    id: `${userId}-run`,
    featureName: "support-ticket-triage",
    userId,
    organizationId,
    provider: "openai",
    model: "gpt-4.1-mini",
    promptId: "support-ticket-triage",
    promptVersion: "1.0.0",
    promptHash: "abc",
    status: "success",
    inputTokens: 1,
    outputTokens: 1,
    estimatedCost: 0.1,
    latencyMs: 10,
    retryCount: 0,
    fallbackUsed: false,
    traceId: "trace",
    createdAt: new Date("2026-06-01T12:00:00Z"),
  };
}
