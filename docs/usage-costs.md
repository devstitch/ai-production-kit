# Usage and cost

## Normalized usage

Every completed provider call can produce one record:

```ts
{
  inputTokens,
  outputTokens,
  cachedInputTokens, // omitted when the provider does not report it
  cacheWriteTokens,  // omitted when the provider does not report it
  totalTokens,
  provider,
  model,
  feature,
  userId,
  organizationId,
  timestamp
}
```

A missing cache field is not stored as zero. Zero would claim the provider reported no cached tokens.

The runner passes this record to the `afterProviderCall` hook.

## Pricing

Register rates in USD per token. `estimate` returns `{ amount, currency: "USD", isEstimate: true }`. This is not a provider invoice.

`effectiveFrom` selects the latest rate that had started by the run time. An unknown provider and model throws `AIConfigurationError` from the runner. The registry itself throws `UnregisteredPriceError`.

`createExamplePricing` seeds illustrative rates for `gpt-4.1-mini` and `claude-haiku-4-5`. Replace them with current rates in application code.

## Ledger

`UsageStore.record` writes one row per finished run, including failures that happen after the run is prepared. The row has no raw prompt and no model output.

`MemoryUsageStore` is the default. `PostgresUsageStore` uses the SQL in `packages/usage/migrations/0001_ai_runs.sql`. Tests run that SQL on PGlite, so `pnpm test` does not need a database server.

## Quotas

Quota strings are `"100/day"` or `"5000/month"`. A month is 30 days. The enforced unit is `requests`. `tokens` and `cost` are accepted by the type and rejected until a later version implements them.

`perUser` and `perOrganization` on a feature count runs of that feature. `quota.feature` is an additional cap for the feature as a whole, such as `"500/month"` on invoice extraction. The feature name is the feature's `name`, not a prefix inside the string.

A quota failure throws `AIQuotaExceededError` before the provider call.

## Budgets

`maxCostPerRun` cannot be known exactly before the provider responds. When the feature already has recorded runs for the organization, the average estimated cost is compared with the cap. With no history, that pre-check is skipped.

`budget.monthly` blocks when the feature's estimated spend for the organization over the last 30 days is at the cap. `budget.organizationMonthly` does the same for the whole organization. Both throw `AIBudgetExceededError` before the provider call.
