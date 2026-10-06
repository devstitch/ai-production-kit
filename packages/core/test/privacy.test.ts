import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { definePrompt, PromptRegistry } from "@devstitch/prompts";
import { PricingRegistry } from "@devstitch/usage";
import { createAIRuntime } from "../dist/runner/create-runtime.js";
import type { TelemetryEvent } from "../dist/runner/record-telemetry.js";
import type { ProviderAdapter } from "../dist/types/provider.js";

const inputSchema = z.object({ subject: z.string() });
const prompts = new PromptRegistry();
definePrompt(
  {
    id: "support-ticket-triage",
    version: "1.0.0",
    variables: inputSchema,
    render: (input) => `Subject: ${input.subject}`,
  },
  prompts,
);

const pricing = new PricingRegistry();
pricing.register({
  provider: "openai",
  model: "gpt-4.1-mini",
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  inputTokenRate: 0,
  outputTokenRate: 0,
});

const context = {
  userId: "user-1",
  organizationId: "org-secret-marker",
  featureFlags: { internalFlag: true },
};

function feature(overrides: Record<string, unknown> = {}) {
  return {
    name: "support-ticket-triage",
    input: inputSchema,
    output: z.object({ category: z.string() }),
    prompt: { id: "support-ticket-triage", version: "1.0.0" },
    model: { primary: "openai:gpt-4.1-mini" },
    ...overrides,
  };
}

function adapter(seen: string[]): ProviderAdapter {
  return {
    async generateStructured(request) {
      seen.push(request.prompt);
      return {
        data: { category: "billing" },
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        finishReason: "stop",
      };
    },
    generateStream() {
      throw new Error("stream is not used");
    },
  };
}

test("raw prompt and output text stay out of telemetry by default", async () => {
  const events: TelemetryEvent[] = [];
  const seen: string[] = [];
  const ai = createAIRuntime({
    providers: { openai: adapter(seen) },
    prompts,
    pricing,
    telemetry: { record: (event) => events.push(event) },
  });
  await ai.run(feature(), { input: { subject: "marker-subject-text" }, context });
  const serialized = JSON.stringify(events);
  assert.equal(serialized.includes("marker-subject-text"), false);
  assert.equal(serialized.includes("billing"), false);
  assert.equal(seen[0]?.includes("org-secret-marker"), false);
  assert.equal(seen[0]?.includes("internalFlag"), false);
});

test("recordContent includes prompt text and a redaction hook can remove it", async () => {
  const events: TelemetryEvent[] = [];
  const ai = createAIRuntime({
    providers: { openai: adapter([]) },
    prompts,
    pricing,
    telemetry: { record: (event) => events.push(event) },
    beforeTelemetryRecord: (attributes) => {
      const copy = { ...attributes };
      delete copy["ai.prompt.text"];
      return copy;
    },
  });
  await ai.run(feature({ telemetry: { recordContent: true } }), {
    input: { subject: "marker-subject-text" },
    context,
  });
  const serialized = JSON.stringify(events);
  assert.equal(serialized.includes("marker-subject-text"), false);
  assert.equal(serialized.includes("billing"), true);
});

test("recordContent without a redaction hook keeps the prompt text", async () => {
  const events: TelemetryEvent[] = [];
  const ai = createAIRuntime({
    providers: { openai: adapter([]) },
    prompts,
    pricing,
    telemetry: { record: (event) => events.push(event) },
  });
  await ai.run(
    feature({ telemetry: { recordContent: true }, privacy: { redact: ["ai.output.text"] } }),
    { input: { subject: "marker-subject-text" }, context },
  );
  const serialized = JSON.stringify(events);
  assert.equal(serialized.includes("marker-subject-text"), true);
  assert.equal(serialized.includes("billing"), false);
});
