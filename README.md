# AI Production Kit

Production infrastructure for AI features in SaaS applications.

```text
Your SaaS Feature
       │
       ▼
┌─────────────────────────────┐
│ DevStitch AI Production Kit │
│                             │
│ Validation                  │
│ Prompt Versions             │
│ Model Routing               │
│ Retries / Timeouts          │
│ Fallbacks                   │
│ Quotas / Budgets            │
│ Cost Tracking               │
│ Observability               │
└─────────────┬───────────────┘
              │
       ┌──────┴───────┐
       ▼              ▼
    OpenAI        Anthropic
```

## What problem this solves

A SaaS feature that calls a model API directly has no shared place for validation, timeouts, retries, fallback, quotas, cost, or traces. Those controls get copied into each feature, or they are missing. This kit makes the AI feature the unit of design and runs those controls in one pipeline.

## Why model API calls alone are not production architecture

A successful prototype call does not say what happens when the provider times out, when the output misses the schema, when one customer consumes the month's budget, or which prompt version produced a bad result. The kit records those decisions on the feature and enforces them before and after the provider call.

## Features

- Typed features with Zod input and structured output
- Streaming replies
- OpenAI and Anthropic through one adapter interface
- Timeouts, retries, and provider fallback
- Application rate limits, request quotas, and budgets
- Normalized token usage, a pricing registry, and an estimated cost
- In-memory and Postgres usage ledgers
- Versioned prompts with a content hash
- OpenTelemetry-style spans, with raw content off by default
- Dataset evaluations and a regression comparison

## Architecture

See `docs/architecture.md`. The runner order is validation, identity, rate limit, quota, budget, prompt, model routing, timeout, provider call, retry, fallback, output validation, usage, telemetry, and the result.

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm --filter @devstitch/example-structured-output build
pnpm --filter @devstitch/example-structured-output start
```

Set `OPENAI_API_KEY` before the example. `pnpm test` does not call a provider.

## Define your first AI Feature

```ts
import { createAIRuntime, defineFeature } from "@devstitch/core";
import { OpenAIAdapter } from "@devstitch/providers";
import { z } from "zod";

const ticketTriage = defineFeature({
  name: "support-ticket-triage",
  input: z.object({ subject: z.string(), message: z.string() }),
  output: z.object({
    category: z.enum(["billing", "technical", "account", "other"]),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    summary: z.string(),
    requiresHuman: z.boolean(),
  }),
  prompt: { id: "support-ticket-triage", version: "1.2.0" },
  model: { primary: "openai:gpt-4.1-mini" },
});

const ai = createAIRuntime({ providers: { openai: new OpenAIAdapter() } });
const result = await ai.run(ticketTriage, {
  input: { subject: "Charged twice", message: "I was billed twice." },
  context: { userId: "user-1", organizationId: "org-1" },
});
```

## Structured output example

`examples/structured-output` defines `support-ticket-triage` and prints the result. The output schema is enforced inside the provider adapter. A mismatch throws `AIOutputValidationError`.

## Streaming example

`examples/streaming` defines `generate-draft-response`, prints chunks as they arrive, then prints run metadata. The demo shows the same stream in the browser. The draft is not sent.

## Retry and fallback

Retries run only for transient failures. Authentication, validation, quota, and budget do not retry. When the feature sets `model.fallback` and the primary failure is eligible, the fallback provider is called. `meta.fallbackUsed` and `meta.providerAttempts` record that path. A primary failure is still sent to telemetry when the fallback succeeds.

`SIMULATE_PRIMARY_FAILURE=true` fails the primary provider before its adapter runs. The demo checkbox does the same for ticket triage.

Details are in `docs/reliability.md` and `docs/model-routing.md`.

## Usage and cost

Token counts are normalized per provider. Cache fields are omitted when the provider does not report them. Register prices with `PricingRegistry`. `meta.estimatedCost` is an estimate, marked `isEstimate: true` on the pricing result. See `docs/usage-costs.md`.

## Quotas and budgets

`quota.perUser` and `quota.perOrganization` use strings such as `"100/day"` and `"5000/month"`. Exceeding either one throws `AIQuotaExceededError` before the provider call.

`budget.organizationMonthly` blocks when recorded estimated spend for the organization is already at the cap. `maxCostPerRun` compares the feature's historical average estimated cost when history exists, and skips that check when it does not. See `docs/usage-costs.md`.

## Prompt versioning

Prompts are code. `definePrompt` validates variables and stores a hash of the render function. A run records the prompt id, version, and hash. See `docs/prompt-versioning.md`.

## Observability

`createTelemetry()` prints spans locally. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to also export OTLP HTTP JSON. See `docs/observability.md`.

## Evaluations

`defineEval` and `compareEvaluations` answer whether quality, latency, tokens, cost, or schema failures changed between two configurations. See `docs/evaluations.md` and `examples/evaluations`.

## Demo

The Support Copilot app has been removed. The runnable examples are `examples/structured-output`, `examples/streaming`, and `examples/evaluations`.

## Production checklist

See `docs/production-checklist.md`.

## Roadmap

V1 does not include RAG, vector databases, MCP, autonomous agents, tool calling, image or voice generation, fine-tuning, a hosted prompt CMS, or a full billing system.

## Contributing

See `CONTRIBUTING.md`. `pnpm test` must pass without provider API keys.

## About DevStitch

DevStitch is an AI-native product engineering company helping founders build, productionize and scale SaaS products, platforms and mobile applications. We work across product engineering, production hardening, AI features, integrations and automation.

[DevStitch](https://devstitch.com)
