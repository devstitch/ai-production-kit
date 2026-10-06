import { createAIRuntime, defineFeature } from "@devstitch/core";
import { OpenAIAdapter } from "@devstitch/providers";
import { z } from "zod";

const draftResponse = defineFeature({
  name: "generate-draft-response",
  input: z.object({
    subject: z.string().min(1),
    message: z.string().min(1),
  }),
  output: z.string(),
  prompt: { id: "generate-draft-response", version: "1.0.0" },
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

const stream = await ai.stream(draftResponse, {
  input: {
    subject: "Charged twice",
    message: "I was billed twice for the same invoice.",
  },
  context: {
    userId: "user-1",
    organizationId: "org-1",
  },
});

for await (const chunk of stream) {
  process.stdout.write(chunk);
}

process.stdout.write("\n");
console.log(JSON.stringify(await stream.meta, null, 2));
