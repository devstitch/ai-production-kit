# Architecture

An application defines an AI feature and calls `ai.run` or `ai.stream`. The runtime, not the feature, owns the production steps:

```text
Input validation
  -> Identity and context
  -> Rate limit
  -> Quota
  -> Budget
  -> Prompt resolution
  -> Model routing
  -> Timeout
  -> Provider request
       -> Retry
       -> Fallback
  -> Output validation
  -> Usage and estimated cost
  -> Telemetry
  -> Result
```

`@devstitch/core` runs that pipeline. It depends on the other packages and they do not depend on core.

| Package | Responsibility |
| --- | --- |
| `@devstitch/core` | Features, errors, runner |
| `@devstitch/providers` | OpenAI and Anthropic adapters |
| `@devstitch/model-router` | Logical model keys and `provider:model` strings |
| `@devstitch/prompts` | Versioned prompt modules and content hashes |
| `@devstitch/reliability` | Timeout, retry classification, fallback eligibility |
| `@devstitch/policies` | Application rate limits and pipeline hooks |
| `@devstitch/usage` | Normalized usage, pricing, quotas, budgets, ledger |
| `@devstitch/telemetry` | Span attributes and the local or OTLP exporter |
| `@devstitch/evals` | Dataset runner and regression comparison |

V1 calls OpenAI and Anthropic through the Vercel AI SDK. The SDK retry option is 0. This repository owns retries and fallback.
