export type EvalCase = {
  input: unknown;
  expected: unknown;
};

export type EvalDefinition = {
  name: string;
  cases: readonly EvalCase[];
};

/**
 * JavaScript reserves `eval`, so the registry function is `defineEval`.
 */
export function defineEval(
  name: string,
  options: { cases: readonly EvalCase[] },
): EvalDefinition {
  return { name, cases: options.cases };
}

export type Scorer = {
  name: string;
  score: (actual: unknown, expected: unknown) => number | boolean;
};

export function schemaScorer(schema: {
  safeParse: (data: unknown) => { success: boolean };
}): Scorer {
  return {
    name: "schema",
    score: (actual) => schema.safeParse(actual).success,
  };
}

export function exactScorer(fields: readonly string[]): Scorer {
  return {
    name: "exact",
    score: (actual, expected) => {
      if (!isRecord(actual) || !isRecord(expected)) return false;
      return fields.every((field) => actual[field] === expected[field]);
    },
  };
}

export function containsScorer(field: string, pattern: string | RegExp): Scorer {
  return {
    name: "contains",
    score: (actual) => {
      const value = isRecord(actual) ? actual[field] : actual;
      if (typeof value !== "string") return false;
      return typeof pattern === "string" ? value.includes(pattern) : pattern.test(value);
    },
  };
}

export function customScorer(
  name: string,
  score: (actual: unknown, expected: unknown) => number | boolean,
): Scorer {
  return { name, score };
}

export type ExecutionResult = {
  output: unknown;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  schemaFailed: boolean;
};

export type CaseReport = {
  input: unknown;
  expected: unknown;
  output: unknown;
  passed: boolean;
  scores: Array<{ name: string; passed: boolean; score: number }>;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  schemaFailed: boolean;
};

export type EvalReport = {
  name: string;
  cases: CaseReport[];
  passRate: number;
  averageLatencyMs: number;
  averageTokens: number;
  averageEstimatedCost: number;
  schemaFailureCount: number;
};

export async function runEvaluation(
  definition: EvalDefinition,
  options: {
    execute: (input: unknown) => Promise<ExecutionResult>;
    scorers: readonly Scorer[];
  },
): Promise<EvalReport> {
  const cases: CaseReport[] = [];
  for (const item of definition.cases) {
    const result = await options.execute(item.input);
    const scores = options.scorers.map((scorer) => {
      const raw = scorer.score(result.output, item.expected);
      const score = typeof raw === "boolean" ? (raw ? 1 : 0) : raw;
      return { name: scorer.name, passed: score > 0, score };
    });
    const schemaPassed = !result.schemaFailed;
    cases.push({
      input: item.input,
      expected: item.expected,
      output: result.output,
      passed: schemaPassed && scores.every((score) => score.passed),
      scores,
      latencyMs: result.latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCost: result.estimatedCost,
      schemaFailed: result.schemaFailed,
    });
  }
  const count = cases.length || 1;
  return {
    name: definition.name,
    cases,
    passRate: cases.filter((item) => item.passed).length / (cases.length || 1),
    averageLatencyMs: cases.reduce((sum, item) => sum + item.latencyMs, 0) / count,
    averageTokens:
      cases.reduce((sum, item) => sum + item.inputTokens + item.outputTokens, 0) / count,
    averageEstimatedCost: cases.reduce((sum, item) => sum + item.estimatedCost, 0) / count,
    schemaFailureCount: cases.filter((item) => item.schemaFailed).length,
  };
}

export type RegressionReport = {
  qualityImproved: boolean;
  passRate: { before: number; after: number };
  latency: { before: number; after: number; delta: number };
  tokens: { before: number; after: number; delta: number };
  estimatedCost: { before: number; after: number; delta: number };
  schemaFailuresIncreased: boolean;
};

/** Answers the five regression questions from the product spec. */
export function compareEvaluations(before: EvalReport, after: EvalReport): RegressionReport {
  return {
    qualityImproved: after.passRate > before.passRate,
    passRate: { before: before.passRate, after: after.passRate },
    latency: {
      before: before.averageLatencyMs,
      after: after.averageLatencyMs,
      delta: after.averageLatencyMs - before.averageLatencyMs,
    },
    tokens: {
      before: before.averageTokens,
      after: after.averageTokens,
      delta: after.averageTokens - before.averageTokens,
    },
    estimatedCost: {
      before: before.averageEstimatedCost,
      after: after.averageEstimatedCost,
      delta: after.averageEstimatedCost - before.averageEstimatedCost,
    },
    schemaFailuresIncreased: after.schemaFailureCount > before.schemaFailureCount,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
