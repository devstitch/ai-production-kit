import {
  compareEvaluations,
  defineEval,
  exactScorer,
  runEvaluation,
  type ExecutionResult,
} from "@devstitch/evals";

const dataset = defineEval("support-ticket-triage", {
  cases: [
    {
      input: { subject: "Charged twice", message: "I was billed twice." },
      expected: { category: "billing" },
    },
    {
      input: { subject: "Cannot log in", message: "The reset link expired." },
      expected: { category: "account" },
    },
  ],
});

function execute(version: "1.0.0" | "1.1.0") {
  return async (input: unknown): Promise<ExecutionResult> => {
    const subject = (input as { subject: string }).subject;
    const category =
      version === "1.0.0" && subject.startsWith("Charged")
        ? "other"
        : subject.startsWith("Charged")
          ? "billing"
          : "account";
    return {
      output: { category },
      latencyMs: version === "1.0.0" ? 40 : 25,
      inputTokens: version === "1.0.0" ? 20 : 12,
      outputTokens: 4,
      estimatedCost: version === "1.0.0" ? 0.02 : 0.01,
      schemaFailed: false,
    };
  };
}

const before = await runEvaluation(dataset, {
  execute: execute("1.0.0"),
  scorers: [exactScorer(["category"])],
});
const after = await runEvaluation(dataset, {
  execute: execute("1.1.0"),
  scorers: [exactScorer(["category"])],
});

console.log(
  JSON.stringify(
    {
      before: { version: "1.0.0", passRate: before.passRate },
      after: { version: "1.1.0", passRate: after.passRate },
      regression: compareEvaluations(before, after),
    },
    null,
    2,
  ),
);
