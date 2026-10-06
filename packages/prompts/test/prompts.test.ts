import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import {
  definePrompt,
  PromptRegistry,
  supportTicketTriage100,
  supportTicketTriage110,
} from "../dist/index.js";

const variables = z.object({
  subject: z.string(),
  message: z.string(),
});

test("rendering with missing required variables fails", () => {
  const prompt = definePrompt({
    id: "draft",
    version: "1.0.0",
    variables,
    render: (input) => `${input.subject}\n${input.message}`,
  });
  const parsed = prompt.variables.safeParse({ subject: "Invoice" });
  assert.equal(parsed.success, false);
});

test("two bodies under the same id and version produce different hashes", () => {
  const first = definePrompt({
    id: "draft",
    version: "1.0.0",
    variables,
    render: (input) => `one ${input.subject}`,
  });
  const second = definePrompt({
    id: "draft",
    version: "1.0.0",
    variables,
    render: (input) => `two ${input.subject}`,
  });
  assert.notEqual(first.hash, second.hash);
});

test("ticket triage 1.0.0 and 1.1.0 render the ticket", () => {
  const registry = new PromptRegistry();
  const first = supportTicketTriage100(registry);
  const second = supportTicketTriage110(registry);
  const input = { subject: "Charged twice", message: "I was billed twice." };
  assert.match(first.render(input), /Charged twice/);
  assert.match(second.render(input), /Prefer billing/);
  assert.equal(registry.get("support-ticket-triage", "1.0.0")?.hash, first.hash);
  assert.notEqual(first.hash, second.hash);
});
