# Privacy

Raw prompt text and raw model output are omitted from telemetry unless `feature.telemetry.recordContent` is `true`.

Context fields such as `userId`, `organizationId`, and `featureFlags` are not copied into the provider prompt. They appear in the prompt only when the template reads them from the validated input.

`feature.privacy.redact` deletes named attributes before they are recorded. `createAIRuntime({ beforeTelemetryRecord })` can delete or rewrite attributes after that, including when content recording is on.

The usage ledger does not have columns for prompt text or model output. Compare prompt versions through the recorded id, version, and hash. The model output stays with the caller and is not written to the store.

Provider API keys are read on the server. Do not put them in client components or commit them.
