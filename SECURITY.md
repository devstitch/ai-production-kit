# Security

## Reporting a vulnerability

Email security@devstitch.example with a description, the affected package, and a way to reproduce the issue. Do not open a public issue for an unfixed vulnerability.

## Keys and data

Provider API keys stay on the server. Do not put them in client components, logs, or git.

Telemetry omits raw prompt text and raw model output unless a feature sets `telemetry.recordContent`. The usage ledger has no columns for that content.

Review `docs/privacy.md` and `docs/production-checklist.md` before shipping a feature.

## Dependencies

Keep `pnpm-lock.yaml` updated in the pull request that changes dependencies. Do not add a provider key to a test that runs in CI.
