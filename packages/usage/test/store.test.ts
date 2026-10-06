import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryUsageStore, PostgresUsageStore } from "../dist/index.js";
import type { StoredRun, UsageStore } from "../dist/index.js";

const window = {
  start: new Date("2026-06-01T00:00:00Z"),
  end: new Date("2026-06-03T00:00:00Z"),
};

test("the in-memory store aggregates user and organization usage", async () => {
  await assertAggregates(new MemoryUsageStore());
});

test("the postgres store aggregates user and organization usage", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const store = new PostgresUsageStore(db);
  await store.migrate();
  await assertAggregates(store);
  await db.close();
});

async function assertAggregates(store: UsageStore) {
  await store.record(run("a", "user-1", "org-1", 2));
  await store.record(run("b", "user-1", "org-1", 3));
  await store.record(run("c", "user-2", "org-1", 5));
  await store.record(run("d", "user-1", "org-2", 9));
  await store.record({
    ...run("old", "user-1", "org-1", 100),
    createdAt: new Date("2026-05-01T00:00:00Z"),
  });

  const user = await store.getUserUsage("user-1", "org-1", window);
  assert.equal(user.requests, 2);
  assert.equal(user.estimatedCost, 5);

  const organization = await store.getOrganizationUsage("org-1", window);
  assert.equal(organization.requests, 3);
  assert.equal(organization.estimatedCost, 10);

  const summary = await store.summarize({ organizationId: "org-1", since: window.start, until: window.end });
  assert.equal(summary.runs, 3);
  assert.equal(summary.fallbackCount, 1);
}

function run(id: string, userId: string, organizationId: string, estimatedCost: number): StoredRun {
  return {
    id,
    featureName: "support-ticket-triage",
    userId,
    organizationId,
    provider: "openai",
    model: "gpt-4.1-mini",
    promptId: "support-ticket-triage",
    promptVersion: "1.2.0",
    promptHash: "hash",
    status: "success",
    inputTokens: 4,
    outputTokens: 2,
    estimatedCost,
    latencyMs: 20,
    retryCount: 0,
    fallbackUsed: id === "c",
    traceId: id,
    createdAt: new Date("2026-06-02T00:00:00Z"),
  };
}
