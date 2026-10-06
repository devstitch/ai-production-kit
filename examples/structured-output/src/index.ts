import { createAIRuntime, defineFeature } from "@devstitch/core";
import { OpenAIAdapter } from "@devstitch/providers";
import { z } from "zod";

const ticketTriage = defineFeature({
  name: "support-ticket-triage",
  input: z.object({
    subject: z.string().min(1),
    message: z.string().min(1),
  }),
  output: z.object({
    category: z.enum(["billing", "technical", "account", "other"]),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    summary: z.string(),
    requiresHuman: z.boolean(),
  }),
  prompt: { id: "support-ticket-triage", version: "1.0.0" },
  model: { primary: "openai:gpt-4.1-mini" },
  timeout: 30_000,
});

if (process.env.OPENAI_API_KEY === undefined || process.env.OPENAI_API_KEY === "") {
  console.error("Set OPENAI_API_KEY before running this example.");
  process.exit(1);
}

const ai = createAIRuntime({
  providers: { openai: new OpenAIAdapter() },
});

const result = await ai.run(ticketTriage, {
  input: {
    subject: "Charged twice",
    message: "I was billed twice for the same invoice.",
  },
  context: {
    userId: "user-1",
    organizationId: "org-1",
  },
});

console.log(JSON.stringify(result, null, 2));
