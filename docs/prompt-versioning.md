# Prompt versioning

Prompts are versioned TypeScript modules, not a hosted prompt CMS.

```ts
definePrompt({
  id: "support-ticket-triage",
  version: "1.2.0",
  variables: TicketInput,
  render: (input) => `Subject: ${input.subject}\nMessage: ${input.message}`,
});
```

The runner resolves `feature.prompt` to a registered prompt, checks the variables, and sends `render(input)` to the provider.

Invalid variables throw `AIInputValidationError` before the provider call. A missing id or version throws `AIConfigurationError`.

Each prompt stores `hash`, the SHA-256 of `render.toString()`. The run records `promptId`, `promptVersion`, and `promptHash`. Editing a version file without changing the version changes the hash, so the drift is visible.

The built-in examples are `support-ticket-triage` versions `1.0.0`, `1.1.0`, and `1.2.0`, and `generate-draft-response` version `1.0.0`.
