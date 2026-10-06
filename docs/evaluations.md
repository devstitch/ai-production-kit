# Evaluations

`defineEval` registers a dataset. JavaScript reserves the name `eval`, so the function is `defineEval`.

```ts
const dataset = defineEval("support-ticket-triage", {
  cases: [{ input, expected }],
});

const report = await runEvaluation(dataset, {
  execute,
  scorers: [exactScorer(["category"]), containsScorer("summary", /invoice/)],
});
```

V1 scorers are schema validation, exact field match, contains or regex, and a custom function. There is no semantic similarity and no model judge.

The report includes pass or fail per case, pass rate, average latency, average tokens, average estimated cost, and schema-failure count.

`compareEvaluations(before, after)` answers:

- Did the pass rate improve?
- Did latency change?
- Did token use change?
- Did estimated cost change?
- Did schema failures increase?

`examples/evaluations` runs a ticket-triage dataset through two fake prompt versions and prints that comparison. It does not call a provider.
