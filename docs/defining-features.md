# Defining features

`defineFeature` checks that a feature has a name, Zod input and output schemas, a prompt id and version, and a primary model.

```ts
const ticketTriage = defineFeature({
  name: "support-ticket-triage",
  input: TicketInput,
  output: TicketTriage,
  prompt: { id: "support-ticket-triage", version: "1.2.0" },
  model: {
    primary: "openai:gpt-4.1-mini",
    fallback: "anthropic:claude-haiku-4-5",
  },
  timeout: 15_000,
  retries: { attempts: 2, backoff: "exponential", maxDelayMs: 8_000 },
  quota: { perUser: "100/day", perOrganization: "5000/month" },
  budget: { maxCostPerRun: 0.1, organizationMonthly: 25 },
  rateLimit: { limit: 10, windowSeconds: 60 },
});
```

Application code then calls `ai.run(ticketTriage, { input, context })`. `context.userId` and `context.organizationId` are required. They are used for limits and the ledger. They are not sent to the provider unless the prompt template reads them from the validated input.
