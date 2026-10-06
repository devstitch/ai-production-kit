import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareEvaluations,
  containsScorer,
  defineEval,
  exactScorer,
  runEvaluation,
} from "../dist/index.js";

test("a dataset reports pass rate, latency, tokens, cost, and schema failures", async () => {
  const suite = defineEval("support-ticket-triage", {
    cases: [
      { input: { subject: "charge" }, expected: { category: "billing" } },
      { input: { subject: "login" }, expected: { category: "account" } },
    ],
  });
  const report = await runEvaluation(suite, {
    scorers: [exactScorer(["category"]), containsScorer("summary", /invoice|login/)],
    async execute(input) {
      const subject = (input as { subject: string }).subject;
      return {
        output: {
          category: subject === "charge" ? "billing" : "technical",
          summary: subject === "charge" ? "invoice" : "login",
        },
        latencyMs: subject === "charge" ? 10 : 30,
        inputTokens: 4,
        outputTokens: 2,
        estimatedCost: 0.01,
        schemaFailed: false,
      };
    },
  });
  assert.equal(report.passRate, 0.5);
  assert.equal(report.schemaFailureCount, 0);
  assert.equal(report.averageLatencyMs, 20);
  assert.equal(report.averageTokens, 6);
});

test("regression comparison answers the five product questions", () => {
  const diff = compareEvaluations(
    {
      name: "v1",
      cases: [],
      passRate: 0.4,
      averageLatencyMs: 40,
      averageTokens: 20,
      averageEstimatedCost: 0.2,
      schemaFailureCount: 1,
    },
    {
      name: "v2",
      cases: [],
      passRate: 0.8,
      averageLatencyMs: 25,
      averageTokens: 12,
      averageEstimatedCost: 0.1,
      schemaFailureCount: 2,
    },
  );
  assert.equal(diff.qualityImproved, true);
  assert.equal(diff.latency.delta, -15);
  assert.equal(diff.tokens.delta, -8);
  assert.equal(diff.estimatedCost.delta, -0.1);
  assert.equal(diff.schemaFailuresIncreased, true);
});
