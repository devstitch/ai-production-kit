# Implementation Process

How we build this repo from `docs/cursor-prompts.md`, one prompt at a time.

The spec stays in `docs/srs.md`. The prompt sequence stays in `docs/cursor-prompts.md`. This file is the working agreement for how those prompts get implemented.

## Rules

1. Discuss before code. For each prompt, write up what it covers, the open questions, and the implementation plan. Do not edit application code, config, or package files until that plan is approved.
2. Decisions are asked, not assumed. If a prompt says "your call", "or equivalent", "technical lead may simplify", or two readings both fit the spec, stop and ask. A recommendation is allowed. Implementing that recommendation is not, until it is approved.
3. No fallbacks without permission. Do not add an alternate path, silent default, or degraded behavior to get past an ambiguity. This includes product fallbacks (provider fallback, `SIMULATE_PRIMARY_FAILURE`, stub behavior that hides a missing decision) and process fallbacks (picking a package layout, naming scheme, or tool when the choice was still open).
4. One prompt at a time. Finish the discussion, the implementation, and a review of that prompt before opening the next one.
5. Stay inside the prompt. Do not pull later-prompt behavior forward. Empty packages, stubs, and placeholders are only what the current prompt explicitly asks for.
6. The spec wins on product behavior. `docs/srs.md` is the product. `docs/cursor-prompts.md` is the build order. If they conflict, call it out in the discussion and wait for a decision.

## What each discussion must include

- Scope: what this prompt will add, and what it will leave untouched.
- Confusions: anything ambiguous, conflicting, or easy to over-build.
- Plan: concrete steps, files, and how we will know the prompt is done.
- Decisions needed: each choice that will not be made alone, with a recommendation where one is useful.

## Status

| Prompt | Milestone | Topic | Status |
| --- | --- | --- | --- |
| 1 | M1 | Monorepo scaffolding | Done |
| 2 | M1 | Types, errors, `defineFeature` | Done |
| 3 | M1 | Provider boundary (OpenAI + Anthropic) | Done |
| 4 | M1 | Feature runner and pipeline skeleton | Done |
| 5 | M1 | Streaming | Done |
| 6 | M2 | Model registry and routing | Done |
| 7 | M2 | Timeout policy | Done |
| 8 | M2 | Retry policy | Done |
| 9 | M2 | Provider fallback | Done |
| 10 | M2/M3 | Rate limiting | Done |
| 11 | M3 | Usage tracking and token normalization | Done |
| 12 | M3 | Pricing registry and cost estimation | Done |
| 13 | M3 | Usage ledger | Done |
| 14 | M3 | Quotas | Done |
| 15 | M3 | Budget controls | Done |
| 16 | M4 | Prompt registry, versioning, hashes | Done |
| 17 | M4 | OpenTelemetry and privacy-aware telemetry | Done |
| 18 | M5 | Evaluation framework | Done |
| 19 | M5 | Demo app | Done |
| 20 | M6 | Tests, CI, docs, OSS polish | Done |

Repo state when this process started: `docs/srs.md` and `docs/cursor-prompts.md` only. No packages, app, or tooling yet.

## Prompt 1 approved plan

Implementation started after the discussion. These choices are the ones recommended in that discussion:

- Package names are `@devstitch/core`, `@devstitch/model-router`, `@devstitch/prompts`, `@devstitch/reliability`, `@devstitch/usage`, `@devstitch/telemetry`, `@devstitch/policies`, `@devstitch/evals`, and `@devstitch/shared`. Example packages use `@devstitch/example-*`. `@devstitch/demo` was removed later.
- `@devstitch/core` depends on model-router, reliability, usage, telemetry, prompts, and policies. Those packages do not depend on core. `shared` and `evals` have no dependents yet.
- Zod is pinned once in the pnpm catalog. Only `@devstitch/shared` depends on it. Nothing imports it yet.
- Example folders are workspace packages with an empty entry so `pnpm build` includes them.
- `apps/demo` was a Next.js App Router app. It has since been removed.
- `.env.example` has a comment only. Provider keys wait for a later prompt.
- `reliability/fallback` is an empty folder. No fallback behavior.

Done when `pnpm install` and `pnpm build` succeed.

## Prompt 2 decisions

Implemented in `packages/core`. No runner and no provider calls.

- `@devstitch/core` depends on `zod` through the existing catalog. Types stay in core.
- A missing schema, a missing name, prompt, or primary model, and a duplicate registry name throw `AIConfigurationError`.
- `retryable` follows the spec's retry rules: provider rate limit, timeout, and provider unavailable are retryable. Input validation, output validation, authentication, quota, budget, configuration, and generic execution errors are not.
- `RunResult.meta.attempts` is a number, the retry count. Prompt 9 later shows an attempts array. That conflict waits for the Prompt 9 discussion.
- `RunContext.featureFlags` is `Readonly<Record<string, boolean>>`.
- Tests use Node's built-in test runner. Six tests passed.

## Prompt 3 decisions

Implemented in `packages/providers`. `packages/core` does not import it.

- Adapters live in a new package instead of `model-router`. `core` already depends on `model-router`, and the adapters need `core` for errors, so putting them in `model-router` would cycle.
- Structured calls use `generateText` with `Output.object`. That is the current AI SDK equivalent of `generateObject`.
- `generateStream` returns `{ stream, completion }`. `completion` resolves to usage and finish reason after the stream finishes.
- The AI SDK retry option is set to 0. Retries belong to the later reliability prompt.
- Cache token fields are omitted when a provider does not report them.
- `pnpm test` runs the unit tests only. The live OpenAI and Anthropic calls are `pnpm --filter @devstitch/providers test:live`. Default models for that command are `gpt-4.1-mini` and `claude-haiku-4-5`, overridable with `OPENAI_LIVE_MODEL` and `ANTHROPIC_LIVE_MODEL`.

## Prompts 4–10 decisions

Implemented together because the request was to build through prompt 10. Quota and budget stay no-ops. Usage accounting returns `estimatedCost: 0` and does not write a ledger. Prompt resolution builds a text prompt from the feature name, prompt id and version, and the validated input. It does not send context metadata to the model.

- `createAIRuntime` requires `providers`. Prompt 4's signature only listed `models`, `telemetry`, and `usageStore`. Core cannot import the concrete adapters, so the caller passes `{ openai, anthropic }` adapters in. `models`, `telemetry`, `usageStore`, `rateLimiter`, `simulatePrimaryFailure`, and `sleep` are optional. The default registry is empty. The default rate limiter is in-memory.
- `meta.attempts` stays a number: total provider calls. `retries.attempts: 2` followed by success means `meta.attempts === 3`. Prompt 9's per-provider list is a separate field, `providerAttempts: { provider, status }[]`. Status values are `success`, `timeout`, `unavailable`, `rate_limit`, `authentication`, and `error`.
- A timeout sets `meta.timedOut`. Failures attach the same meta on `AIError.runMeta`, because a thrown error has no `RunResult`.
- The default timeout is 15 seconds. The wrapper aborts the provider call. `AITimeoutError` is what the runner throws. Reliability's internal timeout error uses the same `ai_timeout` code.
- Retryable: timeout, provider rate limit, provider unavailable, and execution errors whose cause is HTTP 429, HTTP 5xx, or a transient network code. Authentication, validation, configuration, quota, budget, and the application rate limit are not retryable.
- Fallback eligibility is a separate function. It covers timeout, provider unavailable, provider rate limit, HTTP 429, and HTTP 5xx. It does not cover authentication, validation, configuration, quota, budget, or the application rate limit. A primary failure is recorded as telemetry type `provider_failure` even when the fallback succeeds.
- `SIMULATE_PRIMARY_FAILURE=true`, or `createAIRuntime({ simulatePrimaryFailure: true })`, throws `AIProviderUnavailableError` before the primary adapter runs. The fallback provider is not simulated. Because that error is retryable, a feature with retries will retry the simulated failure.
- Streaming returns `Promise<AsyncIterable<string> & { meta: Promise<RunResultMeta> }>`. The stream path shares input validation, context, rate limit, quota, budget, prompt resolution, and model routing with `ai.run`. It does not retry or switch providers after chunks have started. Timeout aborts the stream.
- Rate limiting lives in `packages/policies`. The default is 10 requests per 60 seconds for `userId:organizationId:featureName`. A feature can set `rateLimit`. Exceeding it throws `AIRateLimitExceededError` (`ai_rate_limit_exceeded`), which is not retryable and is distinct from `AIProviderRateLimitError`. The Redis limiter takes an injected client so Redis is not required locally.
- Examples `support-ticket-triage` and `generate-draft-response` are Node scripts. They exit with a message when `OPENAI_API_KEY` is missing. They are not part of `pnpm test`.

## Prompts 11–20 decisions

Implemented together because the request was to build the remaining prompts.

- Normalized usage lives in `@devstitch/usage`. Adapters still return token counts. The runner adds provider, model, feature, user, organization, and timestamp, then passes that record to `afterProviderCall`. Cache fields stay omitted when the provider does not report them.
- Prices are USD per token in a registry. The runner maps `UnregisteredPriceError` to `AIConfigurationError`. `estimatedCost` on a run is that estimate. Example rates for `gpt-4.1-mini` and `claude-haiku-4-5` are illustrative.
- `MemoryUsageStore` is the default. `PostgresUsageStore` takes a SQL client. The migration is `packages/usage/migrations/0001_ai_runs.sql` and includes `prompt_hash` so a version can be checked against the body that ran. There is no raw prompt or output column. Postgres tests use PGlite.
- The ledger also exposes `getFeatureUsage`, `listRuns`, and `summarize` so quotas, budgets, and the demo dashboard can read it.
- Quota strings are `100/day` and `5000/month`. A month is 30 days. Only `requests` is enforced. `tokens` and `cost` throw until they exist. User and organization quotas on a feature count that feature. `quota.feature` is the feature-wide cap.
- `maxCostPerRun` uses the average estimated cost of stored runs for that feature and organization. With no history, the pre-check is skipped. `monthly` and `organizationMonthly` block on accumulated estimated spend over 30 days.
- Invalid prompt variables throw `AIInputValidationError`. An unknown prompt id or version throws `AIConfigurationError`. The hash is SHA-256 of the render function source. `meta.promptHash` stores it. `meta.attempts` remains the call count.
- Telemetry prints spans locally and posts OTLP HTTP JSON only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Raw prompt and output text are included only when `telemetry.recordContent` is true. `privacy.redact` and `beforeTelemetryRecord` can remove attributes.
- The evaluation function is `defineEval` because `eval` is reserved in JavaScript. Scorers are schema, exact match, contains or regex, and custom. There is no model judge.
- The Support Copilot app in `apps/demo` was removed after prompt 19. Fallback is still available on `ai.run`. The stream path does not switch providers after it starts. The ledger stores run metadata and does not store model output.
- Live OpenAI and Anthropic calls stay in `test:live` and the examples. `pnpm test` does not use API keys. Scenario 2, 3, and 19 were not executed against live providers in this pass. See `docs/definition-of-done.md`.
