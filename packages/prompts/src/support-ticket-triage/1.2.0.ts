import { z } from "zod";
import { definePrompt, type PromptRegistry } from "../registry.js";

const variables = z.object({
  subject: z.string().min(1),
  message: z.string().min(1),
});

export function supportTicketTriage120(registry?: PromptRegistry) {
  return definePrompt(
    {
      id: "support-ticket-triage",
      version: "1.2.0",
      variables,
      render: (input) =>
        [
          "You are a support triage assistant.",
          "Classify the ticket into category, priority, summary, and requiresHuman.",
          "Use urgent only when the customer cannot use the product.",
          `Subject: ${input.subject}`,
          `Message: ${input.message}`,
        ].join("\n"),
    },
    registry,
  );
}
