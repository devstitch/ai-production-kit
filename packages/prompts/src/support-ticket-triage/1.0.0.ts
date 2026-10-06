import { z } from "zod";
import { definePrompt, type PromptRegistry } from "../registry.js";

const variables = z.object({
  subject: z.string().min(1),
  message: z.string().min(1),
});

export function supportTicketTriage100(registry?: PromptRegistry) {
  return definePrompt(
    {
      id: "support-ticket-triage",
      version: "1.0.0",
      variables,
      render: (input) =>
        [
          "Classify this support ticket.",
          `Subject: ${input.subject}`,
          `Message: ${input.message}`,
          "Return category, priority, summary, and requiresHuman.",
        ].join("\n"),
    },
    registry,
  );
}
