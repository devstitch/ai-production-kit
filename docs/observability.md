# Observability

`createTelemetry()` records one span per run. Local development prints the span. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to also POST an OTLP HTTP JSON payload. The variable is optional.

Span attributes:

| Attribute | Meaning |
| --- | --- |
| `gen_ai.provider.name` | Provider that served the run |
| `gen_ai.request.model` | Model id |
| `gen_ai.client.token.usage` | Input plus output tokens |
| `gen_ai.client.operation.duration` | Latency in milliseconds |
| `ai.feature.name` | Feature name |
| `ai.run.id` | Run id |
| `ai.prompt.id` | Prompt id |
| `ai.prompt.version` | Prompt version |
| `ai.user.id` | User id |
| `ai.organization.id` | Organization id |
| `ai.retry.count` | Extra attempts after the first call |
| `ai.fallback.used` | Whether fallback handled the run |
| `ai.cost.estimated` | Estimated USD cost |

Pipeline hooks live in `@devstitch/policies`: `beforeRun`, `beforeProviderCall`, `afterProviderCall`, `afterRun`, and `onError`. Pass them as `hooks` to `createAIRuntime`.
