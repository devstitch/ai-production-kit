# Definition of done

Status after prompts 1–20. Live provider calls are implemented and kept out of `pnpm test`. They were not executed in this pass.

| Scenario | Status |
| --- | --- |
| 1. Typed feature with structured output | Covered by `defineFeature` tests |
| 2. Run against OpenAI | Adapter and `examples/structured-output`. Live script is `test:live` |
| 3. Same feature shape can target Anthropic | `AnthropicAdapter` and fallback model refs |
| 4. Invalid input rejected before the provider | Core runtime test |
| 5. Invalid structured output rejected | Provider `validateStructuredOutput` test |
| 6. Timeout becomes `AITimeoutError` or fallback | Core timeout test |
| 7. Transient failure is retried | Core retry test |
| 8. Fallback provider succeeds | Core fallback test |
| 9. Metadata shows retries and fallback | `meta.attempts`, `meta.providerAttempts`, `meta.fallbackUsed` |
| 10. Tokens captured | Normalized usage on the run and the ledger |
| 11. Estimated cost from the pricing registry | Pricing tests and runner wiring |
| 12. Quota blocks before the provider | Governance test |
| 13. Organization budget blocks further calls | Governance test |
| 14. Run emits telemetry attributes | Privacy and telemetry tests |
| 15. Raw prompt and output stay out of telemetry by default | Privacy test |
| 16. Prompt version identifies the run | `promptVersion` and `promptHash` |
| 17. Evaluation compares two configurations | `compareEvaluations` and `examples/evaluations` |
| 18. Demo shows a run's cost, latency, provider, prompt, retries, and fallback | The Support Copilot app was removed. Run metadata is still returned by `ai.run` and `ai.stream` |
| 19. Clone, configure keys, and run the demo from the README | The app was removed. The README quick start runs `examples/structured-output` |
