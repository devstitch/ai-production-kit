import { z } from "zod";
import { definePrompt, type PromptRegistry } from "../registry.js";

const variables = z.object({
  subject: z.string().min(1),
  message: z.string().min(1),
});

export function generateDraftResponse100(registry?: PromptRegistry) {
  return definePrompt(
    {
      id: "generate-draft-response",
      version: "1.0.0",
      variables,
      render: (input) =>
        [
          "Write a short support reply. Do not promise a refund.",
          `Subject: ${input.subject}`,
          `Message: ${input.message}`,
        ].join("\n"),
    },
    registry,
  );
}
