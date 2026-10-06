# Cursor Build Prompts — DevStitch AI Production Kit

How to use this: paste these into Cursor **one at a time, in order**, inside the repo you're building. Review/test after each one before moving on — the later prompts (routing, fallback, quotas, budgets) all build on the execution pipeline shape established early, so getting the pipeline right in Prompts 2–4 matters more than speed.

Milestone tags (M1–M6) map to the PRD's implementation milestones.

---

## Prompt 1 — Monorepo scaffolding (M1)

```
Set up a Turborepo + pnpm monorepo called "ai-production-kit" for an open-source TypeScript
production-AI reference architecture. Requirements:

- Package manager: pnpm with pnpm-workspace.yaml; Turborepo root turbo.json (build, dev, lint,
  test pipelines)
- Structure exactly as follows:
  packages/core            (feature/, runner/, errors/, types/)
  packages/model-router
  packages/prompts
  packages/reliability     (retries/, timeout/, fallback/)
  packages/usage           (tokens/, pricing/, quota/, budget/)
  packages/telemetry
  packages/policies
  packages/evals
  packages/shared
  apps/demo
  examples/structured-output
  examples/streaming
  examples/fallback
  examples/quotas
  examples/evaluations
  docs/
- Root: TypeScript strict mode, ESLint + Prettier, .env.example, MIT LICENSE,
  CONTRIBUTING.md, SECURITY.md placeholder, README.md placeholder, Zod as a shared dependency.
- apps/demo: a Next.js + React + TypeScript app (this will become the AI Support Copilot demo
  in a later prompt) — just scaffold it, no features yet.
- Every package should have its own package.json with proper workspace dependency wiring
  (packages/core will end up depending on model-router, reliability, usage, telemetry,
  prompts, policies — set up the dependency graph now even though most packages are empty).
- This step is scaffolding only — no business logic. `pnpm install && pnpm build` should succeed.
```

---

## Prompt 2 — Core types, error taxonomy, and the AI Feature abstraction (M1)

```
In packages/core, build the foundational types and the `defineFeature` abstraction — no
execution logic yet, just the shape of a feature definition and the error model everything
else will use.

1. In packages/core/errors, implement the full error taxonomy as typed classes extending a
   common AIError base (with a `code` and `retryable` flag):
   AIInputValidationError, AIOutputValidationError, AIAuthenticationError,
   AIProviderRateLimitError, AIQuotaExceededError, AIBudgetExceededError, AITimeoutError,
   AIProviderUnavailableError, AIConfigurationError, AIExecutionError.

2. In packages/core/types, define the FeatureDefinition<Input, Output> type matching the PRD's
   shape:
   {
     name: string
     description?: string
     input: ZodSchema<Input>
     output: ZodSchema<Output>
     prompt: { id: string; version: string }
     model: { primary: string; fallback?: string }   // logical model refs, resolved later
     timeout?: number
     retries?: { attempts: number; backoff: "exponential"|"fixed"; maxDelayMs: number }
     quota?: { perUser?: string; perOrganization?: string }
     budget?: { maxCostPerRun?: number }
     telemetry?: { recordContent?: boolean }
     privacy?: { redact?: string[] }
   }

   Also define RunContext { userId, organizationId, requestId?, environment?, featureFlags? }
   and RunResult<Output> {
     data: Output
     meta: { runId, feature, provider, model, promptVersion, inputTokens, outputTokens,
             estimatedCost, latencyMs, attempts, fallbackUsed }
   }

3. In packages/core/feature, implement `defineFeature(definition): FeatureDefinition` — for now
   this just validates the definition shape (e.g. zod schemas are present, name is unique within
   a provided registry) and returns it typed. Add a simple in-memory FeatureRegistry class with
   register()/get()/list().

Add unit tests proving defineFeature rejects a feature missing input/output schemas, and that
duplicate feature names in the same registry are rejected.
```

---

## Prompt 3 — Provider boundary over AI SDK (OpenAI + Anthropic) + structured generation (M1)

```
Add the Vercel AI SDK core plus its OpenAI and Anthropic provider packages as dependencies.
In a new packages/providers (or inside packages/model-router if you prefer fewer packages —
your call, but keep provider-specific code out of packages/core), build a thin DevStitch
boundary around the AI SDK so the rest of the system is not directly coupled to it:

- A `ProviderAdapter` interface with at least:
  generateStructured<T>({ prompt, schema, model, timeout }): Promise<{ data: T; usage; finishReason }>
  generateStream({ prompt, model, timeout }): AsyncIterable<chunk> + final usage metadata
- Concrete adapters: OpenAIAdapter and AnthropicAdapter, both implementing ProviderAdapter using
  the AI SDK's generateObject/streamText (or equivalents) under the hood, reading API keys from
  OPENAI_API_KEY and ANTHROPIC_API_KEY.
- Structured generation must validate the model's output against the feature's Zod output
  schema. If validation fails, throw AIOutputValidationError (from Prompt 2) — do not let
  malformed model output silently reach application code, per the PRD's explicit requirement.
- Normalize both providers' raw usage objects into a single shape: { inputTokens, outputTokens,
  cachedInputTokens?, cacheWriteTokens?, totalTokens }.
- Add .env.example entries for OPENAI_API_KEY and ANTHROPIC_API_KEY.

Add an integration test (clearly marked/tagged as requiring real API keys, separated from the
main unit test suite so CI without keys still passes) that runs one trivial structured-output
call against each provider and confirms the shape of the normalized result.
```

---

## Prompt 4 — Feature runner & execution pipeline skeleton (M1)

```
In packages/core/runner, implement `createAIRuntime({ models, telemetry, usageStore })` and
`ai.run(feature, { input, context })` wiring together the full pipeline described in the PRD,
even though most stages are still no-ops at this point:

  Input Validation
    → Identity/Context (attach RunContext)
    → Rate Limit (no-op stub for now)
    → Quota Check (no-op stub)
    → Budget Check (no-op stub)
    → Prompt Resolution (no-op stub — just use feature.prompt as-is)
    → Model Routing (no-op stub — just use feature.model.primary)
    → Timeout (no-op stub)
    → Provider Request (real — call the ProviderAdapter from Prompt 3)
      → Retry if transient (no-op stub)
      → Fallback if required (no-op stub)
    → Output Validation (real — already enforced inside generateStructured)
    → Usage Accounting (no-op stub)
    → Telemetry (no-op stub)
    → Application Result

Each stage should be its own clearly named function/module so later prompts can fill in real
logic without restructuring the pipeline. Generate a runId (uuid) per run and populate as much
of RunResult.meta as is currently available (provider, model, promptVersion, inputTokens,
outputTokens, latencyMs — leave estimatedCost/attempts/fallbackUsed at sensible defaults for now).

Write an example in examples/structured-output showing a minimal "support-ticket-triage"
feature defined with defineFeature and actually run end-to-end against a real provider,
matching the PRD's example developer experience as closely as possible.
```

---

## Prompt 5 — Streaming support (M1)

```
Extend the runtime to support streaming features for user-facing generation (drafts,
summaries, conversational replies). Requirements:

- Add `ai.stream(feature, { input, context })` returning an async iterable of text chunks.
- After the stream completes, still populate full RunResult.meta (provider, model, tokens,
  cost placeholder, latency, promptVersion, finishReason) — streaming must not skip metadata.
- Record both time-to-first-chunk and total completion time, and include both in meta (add
  `timeToFirstTokenMs` to RunResult.meta's type from Prompt 2).
- Streamed features should still go through the same validate → context → (stubbed)
  rate-limit/quota/budget → prompt resolution → model routing → timeout → provider → telemetry
  pipeline shape as `ai.run` — don't fork into a separate untested code path.

Add examples/streaming with a small "generate-draft-response" feature definition and a simple
Node script (or a route in apps/demo) that consumes the stream and prints chunks as they arrive,
then prints the final meta object once done.
```

---

## Prompt 6 — Model registry & routing (M2)

```
Implement packages/model-router with:
- A model registry: models.register({ key, provider, model }) so features reference logical
  keys ("fast", "balanced") instead of hardcoded provider model IDs, per the PRD. Also support a
  feature referencing a provider:model string directly (e.g. "openai:gpt-model") for simpler cases.
- Resolution logic: given a FeatureDefinition's `model: { primary, fallback? }`, resolve each to
  a concrete { provider, model } pair via the registry.
- Environment override support: allow a registry entry to differ by NODE_ENV/environment (e.g.
  a cheaper model in development, the configured production model in production) without
  touching feature definition code.
- Wire the real model-routing stage into the runner from Prompt 4, replacing the no-op stub —
  `ai.run`/`ai.stream` should now resolve `feature.model.primary` through this registry before
  calling the provider adapter.

Add unit tests: a feature using a logical key resolves correctly in "development" vs
"production" environments; an unregistered model key throws AIConfigurationError (not a raw
crash) at feature-run time.

Document this in docs/model-routing.md (create it): logical models, primary provider, fallback
provider, environment overrides.
```

---

## Prompt 7 — Timeout policy (M2)

```
Implement packages/reliability/timeout: a wrapper that races a provider call against a
configured timeout (feature.timeout, default a sane value like 15000ms if unset) and:
- cancels the underlying provider request where the AI SDK/provider supports abort signals
- throws AITimeoutError (classified, not a generic error) when the timeout fires
- records whether a timeout occurred in run metadata (add a `timedOut` flag or fold it into
  attempts/fallback tracking — your call on exact shape, but it must be visible in meta)

Wire this into the runner's "Timeout" stage, replacing the no-op stub from Prompt 4, for both
ai.run and ai.stream.

Add a unit test using a deliberately slow mock ProviderAdapter that exceeds the configured
timeout, asserting AITimeoutError is thrown and the real provider call is not left dangling
(e.g. assert the abort/cancel path was invoked).
```

---

## Prompt 8 — Retry policy with transient/permanent classification (M2)

```
Implement packages/reliability/retries:
- A classifier function `isRetryable(error): boolean` that returns true only for transient
  conditions (connection failures, selected provider 5xx, eligible rate-limit conditions,
  temporary upstream failures) and false for authentication failures, malformed requests,
  invalid application schema errors, and other clearly permanent configuration errors — per
  the PRD's explicit retry rules.
- A retry executor implementing feature.retries config: { attempts, backoff: "exponential"|
  "fixed", maxDelayMs }. Exponential backoff should actually back off (with jitter), capped at
  maxDelayMs.
- Wire this into the runner's provider-request stage: on a retryable failure, retry up to
  `attempts` times before giving up; on a non-retryable failure, fail immediately without
  consuming retry attempts.
- Record the actual retry count in RunResult.meta.attempts (this field already exists from
  Prompt 2/4 — make sure it's now populated with real data, not a placeholder).

Add unit tests: a mock provider that fails twice (transiently) then succeeds results in a
successful run with attempts=3 recorded; a mock provider returning an authentication error is
never retried and fails immediately with attempts=1.
```

---

## Prompt 9 — Provider fallback (M2)

```
Implement packages/reliability/fallback: when a feature defines model.fallback and the primary
provider call fails for a configured-eligible condition (provider unavailable, timeout,
selected server errors, configured rate-limit failures — reuse the classifier from Prompt 8
where sensible, but fallback eligibility may be a superset/different set than retry eligibility,
so make this explicit and documented, not implicitly reused), the runtime should:
1. Attempt the primary provider (with its own retry policy already applied from Prompt 8)
2. On eligible failure, resolve and call the fallback provider via the model-router from
   Prompt 6
3. Populate RunResult.meta.fallbackUsed: boolean and an `attempts` array recording each
   provider tried and its outcome, matching the PRD's example shape:
   { fallbackUsed: true, attempts: [{ provider: "openai", status: "timeout" },
     { provider: "anthropic", status: "success" }] }
4. Fallback must be observable — never silently swallow the primary failure from telemetry/logs
   even though the end user sees a successful result.

Add a SIMULATE_PRIMARY_FAILURE env var / a test-only adapter flag that forces the primary
provider to fail, specifically to make fallback easy to demo (this will be reused by the demo
app in Prompt 19 — build it now so it's reusable).

Add unit tests: primary fails on an eligible condition -> fallback succeeds -> fallbackUsed is
true with correct attempts array; primary fails on a non-eligible condition (e.g. auth error)
-> no fallback attempted, error propagates.
```

---

## Prompt 10 — Rate limiting (M2/M3)

```
Implement a rate-limit adapter interface in packages/policies (or packages/usage if you'd
rather colocate with quota — your call, just be consistent with the repo structure from
Prompt 1):

  interface RateLimiter {
    check(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfterSeconds?: number }>
  }

Provide:
1. An in-memory implementation (default, zero external dependencies, for local dev)
2. A Redis-compatible implementation behind the same interface, documented but not required
   to run locally

Wire the real rate-limit stage into the runner (replacing the Prompt 4 stub), keyed by a
composite of (userId, organizationId, feature.name), using a sensible default limit if the
feature doesn't configure one explicitly. On limit exceeded, throw a rate-limit-specific error
(reuse or add to the taxonomy from Prompt 2 if needed — note this is distinct from
AIProviderRateLimitError, which is about the upstream provider's own rate limit, not DevStitch's
application-level limiter) before any provider call is attempted.

Add a unit test proving a rate-limited request never reaches the ProviderAdapter (i.e. the
provider mock's call count stays at zero).
```

---

## Prompt 11 — Usage tracking & token normalization (M3)

```
In packages/usage/tokens, formalize the normalized usage shape already introduced in Prompt 3
into its own well-documented type:
  { inputTokens, outputTokens, cachedInputTokens?, cacheWriteTokens?, totalTokens,
    provider, model, feature, userId, organizationId, timestamp }

Make sure every provider adapter (OpenAI, Anthropic) reliably produces this shape even when the
underlying providers report usage differently (e.g. one provider may not support cached-token
reporting — fields should be optional/undefined rather than forcing a zero that implies
something false). Wire this into the runner so every completed run (success or failure, where
usage is available) produces one normalized usage record, and expose it as part of an internal
hook (`afterProviderCall`) so Prompt 12/13 can consume it without re-deriving it.
```

---

## Prompt 12 — Pricing registry & cost estimation (M3)

```
Implement packages/usage/pricing:
  pricing.register({ provider, model, effectiveFrom, inputTokenRate, outputTokenRate,
                      cachedInputTokenRate?, cacheWriteTokenRate? })
  pricing.estimate(usage: NormalizedUsage, at?: Date): EstimatedCost

Requirements:
- Pricing must be a configurable registry, never hardcoded inside feature/business logic
  (per the PRD's explicit requirement).
- Support an `effectiveFrom` date so historical runs can still be priced correctly if rates
  change later (pick the latest entry with effectiveFrom <= run timestamp).
- Clearly type/label the result as an *estimate* (e.g. EstimatedCost.isEstimate: true, or just
  consistent naming) — never imply this is an authoritative provider invoice.
- Wire this into the runner: after a successful provider call, compute estimatedCost and
  populate RunResult.meta.estimatedCost (replacing the Prompt 4 placeholder).
- Seed the registry with placeholder/example rates for the OpenAI and Anthropic models used in
  this project's examples (clearly marked as illustrative, since real rates change over time).

Add unit tests: a run with known token counts and a registered rate produces the exact expected
estimated cost; a request for an unregistered provider/model combination throws
AIConfigurationError rather than silently returning zero or undefined.
```

---

## Prompt 13 — Usage ledger: in-memory + Supabase/Postgres reference store (M3)

```
Define the UsageStore interface in packages/usage:
  interface UsageStore {
    record(run): Promise<void>
    getUserUsage(userId, organizationId, window): Promise<Usage>
    getOrganizationUsage(organizationId, window): Promise<Usage>
  }

Provide:
1. An in-memory implementation for development/tests (default)
2. A Postgres/Supabase-backed implementation as the demo/reference store. Create a migration
   (in apps/demo/supabase/migrations or a shared location — be consistent with where apps/demo
   keeps its schema) for the ai_runs table with fields: id, feature_name, user_id,
   organization_id, provider, model, prompt_id, prompt_version, status, input_tokens,
   output_tokens, cached_tokens, estimated_cost, latency_ms, time_to_first_token_ms,
   retry_count, fallback_used, error_type, trace_id, created_at.
   Do NOT add columns for raw prompt/output content — the PRD explicitly says not to persist
   raw prompts or outputs by default.

Wire createAIRuntime's `usageStore` option (already part of the signature from Prompt 4) so
every completed run, success or failure, is recorded via the configured UsageStore. Make the
in-memory store the default so the project still runs with zero database setup.

Add integration tests proving getUserUsage and getOrganizationUsage correctly aggregate
multiple recorded runs over a given time window for both the in-memory and Postgres
implementations.
```

---

## Prompt 14 — Quotas (M3)

```
Implement packages/usage/quota: support quota dimensions per the PRD —
perUser (e.g. "100/day"), perOrganization (e.g. "5000/month"), and feature-specific quotas
(e.g. "invoice-extraction: 500/month"). Support at least request-count-based quotas in V1;
architect the interface so token-based or cost-based quotas could be added later without a
breaking change (e.g. a `unit: "requests"|"tokens"|"cost"` field, even if only "requests" is
implemented now).

Parse the shorthand string config format ("100/day") into a structured { limit, windowSeconds }
internally. Use the UsageStore from Prompt 13 to compute current usage against the quota window.

Wire the real quota-check stage into the runner (replacing the Prompt 4 stub): if a user or
organization has exceeded their configured quota, throw AIQuotaExceededError BEFORE any
provider call is made — this must be enforced pre-call, not after the fact.

Add unit tests: a user at their daily limit is blocked with zero provider calls made (assert on
the provider mock's call count); a user under their limit proceeds normally; an organization
quota and a user quota can both apply to the same feature and either one tripping blocks the run.
```

---

## Prompt 15 — Budget controls (M3)

```
Implement packages/usage/budget: support feature.budget.maxCostPerRun (a pre-run cap — if the
exact cost can't be known before calling the provider, document this limitation clearly in code
comments and in docs/usage-costs.md, and apply it as a soft guard using the feature's
historical/typical cost if available, falling back to no pre-check if no data exists yet), plus
post-hoc accumulated budget enforcement at organization and feature granularity (e.g.
organization.monthly spend cap).

Wire the real budget-check stage into the runner (replacing the Prompt 4 stub), using the
UsageStore's aggregation methods from Prompt 13: if an organization or feature has already
accumulated spend at or above its configured monthly/period budget, throw
AIBudgetExceededError before any provider call is made, same as the quota stage's pre-call
enforcement requirement.

Add unit tests: an organization at its monthly budget cap is blocked with zero provider calls;
an organization under budget proceeds; after a successful run, accumulated spend increases by
the estimated cost and a subsequent check reflects it correctly.
```

---

## Prompt 16 — Prompt registry, versioning, and hashes (M4)

```
Implement packages/prompts:
  definePrompt({ id, version, variables: ZodSchema, render(vars): string })

Requirements:
- Store prompts as code-first versioned modules, e.g. prompts/support-ticket-triage/1.0.0.ts,
  1.1.0.ts, 1.2.0.ts (or an equivalent registry pattern) — explicitly NOT a hosted prompt CMS,
  per the PRD.
- Validate template variables via the provided Zod schema before rendering; missing/invalid
  variables must fail BEFORE any provider call, with a clear AIConfigurationError or
  AIInputValidationError (pick whichever fits your taxonomy best and document the choice).
- Compute and record a stable content hash (prompt_hash) for every rendered prompt version, so
  a prompt_id + prompt_version + prompt_hash triple can answer "which prompt generated this
  production output?" even if someone edits a version file without bumping the version number
  (the hash should change and be detectable).
- Wire the real prompt-resolution stage into the runner (replacing the Prompt 4 stub):
  feature.prompt.{id,version} resolves to a registered prompt, renders it with the validated
  input, and the resulting text becomes what's sent to the provider adapter. Populate
  RunResult.meta.promptVersion from this resolution.

Add unit tests: rendering with missing required variables fails before any provider mock is
called; two different prompt bodies under the same id/version produce two different
prompt_hashes (proving hash drift is detectable); a real example prompt
(prompts/support-ticket-triage/1.0.0.ts and 1.1.0.ts) renders correctly end to end.

Document this in docs/prompt-versioning.md (create it).
```

---

## Prompt 17 — OpenTelemetry observability + privacy-aware telemetry (M4)

```
Implement packages/telemetry with OpenTelemetry-compatible instrumentation. Requirements:

- Emit a span per feature run with attributes following OpenTelemetry GenAI semantic
  conventions where one already exists (gen_ai.provider.name, gen_ai.request.model,
  gen_ai.client.token.usage, gen_ai.client.operation.duration), and DevStitch-specific
  attributes where no convention exists (ai.feature.name, ai.run.id, ai.prompt.id,
  ai.prompt.version, ai.user.id, ai.organization.id, ai.retry.count, ai.fallback.used,
  ai.cost.estimated).
- Wire the real telemetry stage into the runner (replacing the Prompt 4 stub) for both ai.run
  and ai.stream, recording success and failure cases, retries, and fallback events.
- Provide a local-friendly console/dev exporter as the default so OTEL_EXPORTER_OTLP_ENDPOINT
  is NOT required for local development, per the PRD — only wire a real OTLP exporter when that
  env var is configured.
- Privacy-aware by default: raw prompt text and raw model output must NOT be included in any
  telemetry attribute unless feature.telemetry.recordContent is explicitly set to true. Add a
  redaction hook (`beforeTelemetryRecord(attributes) => attributes`) so developers can filter
  specific fields even when content recording is enabled.
- Also implement the smaller policy hook set mentioned in the PRD (beforeRun, beforeProviderCall,
  afterProviderCall, afterRun, onError) as a thin hook registry in packages/policies, and call
  them at the appropriate pipeline stages in the runner. Keep this hook API small — no general
  workflow engine.

Add tests proving: a run's telemetry span never contains raw prompt/output text by default;
setting recordContent: true causes it to appear; a redaction hook can strip a specific field
even when recordContent is true.

Document this in docs/observability.md and docs/privacy.md (create both).
```

---

## Prompt 18 — Evaluation framework & regression testing (M5)

```
Implement packages/evals: a lightweight, deterministic evaluation runner.

  eval("feature-name", { cases: [ { input, expected } ] })

Support these scorer types for V1 (per the PRD — do not build semantic similarity or
model-as-judge yet):
- Schema validation (did output satisfy the expected structure?)
- Exact match (expected.category === actual.category)
- Contains/regex (for generated text fields)
- Custom scorer function (score(result, expected) => number|boolean)

The runner should execute a full dataset against a given feature + prompt version + model
configuration and produce a report: pass/fail per case, aggregate pass rate, average latency,
average tokens, average estimated cost, and schema-failure count.

Build a regression-comparison helper: run the same dataset against two configurations (e.g.
prompt v1.0.0 vs v1.1.0, or model "fast" vs "balanced") and produce a diff report answering:
did quality (pass rate) improve? did latency change? did token use change? did estimated cost
change? did schema failures increase? — matching the PRD's exact regression questions.

Add examples/evaluations with a small evaluation dataset for the ticket-triage feature and a
script demonstrating a v1-vs-v2 prompt comparison.

Document this in docs/evaluations.md (create it).
```

---

## Prompt 19 — Demo app: AI Support Copilot, run inspector, usage dashboard, fallback demo (M5)

```
Build out apps/demo as the "AI Support Copilot" reference application described in the PRD.

Feature A — Ticket Triage (structured output):
- A simple form: subject + customer message input
- Defines and runs a "support-ticket-triage" feature (reuse/extend the one from Prompt 4's
  example) returning { category, priority, summary, requiresHuman } via defineFeature +
  definePrompt + the full runtime pipeline built in Prompts 1–18
- Enforces quotas/budget/rate-limit, uses prompt versioning, tracks cost, and is traced —
  i.e. it must exercise the real production pipeline, not a simplified shortcut

Feature B — Draft Response (streaming):
- Given a ticket, stream a suggested support reply to the UI using ai.stream from Prompt 5
- No autonomous email sending — just display the streamed draft as it arrives

Run Inspector:
- After any run (triage or draft), show a developer-facing panel with exactly the fields from
  the PRD: Feature, Provider, Model, Prompt version, Latency, Input tokens, Output tokens,
  Estimated cost, Retries, Fallback (yes/no), Trace ID

Usage Dashboard:
- A minimal internal page showing: Runs Today, Tokens, Estimated Cost, Success Rate, Average
  Latency, Fallback Count — filterable by feature, provider, model, and organization/user where
  applicable. Pull this from the UsageStore (Prompt 13), not ad hoc queries.

Prompt Version Display:
- Show which prompt version (e.g. "Ticket Triage — Prompt v1.2.0") generated each run, and allow
  browsing runs by prompt version so a developer can compare outputs across versions.

Fallback Demonstration:
- Wire the SIMULATE_PRIMARY_FAILURE flag from Prompt 9 into the demo so a developer can toggle
  it, trigger a run, and visibly see in the Run Inspector that the primary provider failed and
  the fallback provider succeeded.

Keep the UI simple and functional — this is a reference app, not a polished product, per the PRD.
```

---

## Prompt 20 — Full test suite, CI, docs, README, and final OSS polish (M6)

```
Do a final consolidation pass across the whole repo:

Testing — ensure these all exist and pass, matching the PRD's exact test requirements:
Unit tests: input validation, prompt resolution, pricing calculations, quota calculation,
budget checks, retry classification, fallback decisions, error normalization.
Integration tests: OpenAI adapter, Anthropic adapter, structured generation, streaming,
telemetry, usage persistence, quota rejection, fallback behavior. Keep provider-dependent live
tests (the ones needing real API keys) clearly separated/tagged from the main suite so
contributors without paid API keys can still run `pnpm test` successfully in CI.
Reliability test cases (explicit named tests): timeout -> AITimeoutError or fallback; transient
provider failure -> retry then fallback when configured; invalid input -> rejected before
provider execution; invalid structured output -> AIOutputValidationError; quota exceeded ->
AIQuotaExceededError with no provider call; budget exceeded -> AIBudgetExceededError with no
provider call.
Privacy tests: raw content off by default in telemetry; configured redaction actually redacts;
internal context metadata not explicitly part of the prompt is never sent to the provider.

CI: a GitHub Actions workflow running install, lint, build, and the non-live test suite on
every push/PR.

Docs — finish all files referenced throughout this sequence if not already complete:
architecture.md, defining-features.md, model-routing.md, reliability.md, usage-costs.md,
prompt-versioning.md, observability.md, privacy.md, evaluations.md, and a new
production-checklist.md containing exactly the checklist from the PRD (input validation,
structured output validation, timeout configured, retry configured, fallback decision made,
quotas configured, budget configured, usage tracked, prompt versioned, telemetry enabled,
sensitive logging reviewed, evaluations passing).

README.md — follow the PRD's exact required structure: title "AI Production Kit", tagline
"Production infrastructure for AI features in SaaS applications.", the ASCII architecture box
from the PRD (Your SaaS Feature -> DevStitch AI Production Kit [validation/prompt
versions/model routing/retries/fallbacks/quotas/cost tracking/observability] -> OpenAI /
Anthropic), then sections in order: What problem this solves; Why model API calls alone are not
production architecture; Features; Architecture; Quick start; Define your first AI Feature;
Structured output example; Streaming example; Retry and fallback; Usage and cost; Quotas and
budgets; Prompt versioning; Observability; Evaluations; Demo; Production checklist; Roadmap;
Contributing; About DevStitch. The "About DevStitch" section should be short and
non-promotional, matching: "DevStitch is an AI-native product engineering company helping
founders build, productionize and scale SaaS products, platforms and mobile applications. We
work across product engineering, production hardening, AI features, integrations and
automation." with a placeholder link.

Repository hygiene — confirm: MIT LICENSE is real (not placeholder); .env.example lists every
env var with comments (OPENAI_API_KEY, ANTHROPIC_API_KEY, DATABASE_URL,
OTEL_EXPORTER_OTLP_ENDPOINT, SIMULATE_PRIMARY_FAILURE, etc.); CONTRIBUTING.md and SECURITY.md
are real; .github/ISSUE_TEMPLATE/ and PULL_REQUEST_TEMPLATE.md exist; no hardcoded/committed API
keys anywhere (grep for leaked secrets); ESLint/Prettier pass cleanly across all packages.

Finally, check off all 19 "Definition of Done" scenarios from the PRD against the actual repo
state and list anything still incomplete before tagging a v1 release.
```

---

### Notes on using this sequence

- **Prompts 6–9 (routing, timeout, retry, fallback) are the project's architectural core** — the PRD explicitly ranks reliability above everything else except correctness. Don't let Cursor rush through these to get to the flashier demo in Prompt 19.
- **Live provider tests cost real money.** Keep them tagged/separated as instructed in Prompts 3 and 20 so routine `pnpm test` runs (and CI) don't require API keys or incur charges.
- Prompt 9's `SIMULATE_PRIMARY_FAILURE` flag is deliberately introduced early and reused in the demo — it's the single easiest way to *show* someone the value of this whole repo in under a minute, so don't skip wiring it into the UI in Prompt 19.
