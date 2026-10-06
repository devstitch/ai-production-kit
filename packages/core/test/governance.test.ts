import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { definePrompt, PromptRegistry } from "@devstitch/prompts";
import { MemoryUsageStore, PricingRegistry } from "@devstitch/usage";
import {
  AIBudgetExceededError,
  AIConfigurationError,
  AIInputValidationError,
  AIQuotaExceededError,
} from "../dist/errors/ai-error.js";
import { createAIRuntime } from "../dist/runner/create-runtime.js";
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
const strictPrompts = new PromptRegistry();
definePrompt(
  {
    id: "support-ticket-triage",
    version: "1.0.0",
    variables: z.object({ subject: z.string(), message: z.string() }),
    render: (input) => `${input.subject} ${input.message}`,
  },
  strictPrompts,
);

const usage = { inputTokens: 4, outputTokens: 2, totalTokens: 6 };
const context = { userId: "user-1", organizationId: "org-1" };

function adapter(): ProviderAdapter & { calls: number } {
  const state = {
    calls: 0,
    async generateStructured() {
      state.calls += 1;
      return { data: { category: "billing" }, usage, finishReason: "stop" };
    },
    generateStream() {
      throw new Error("stream is not used");
    },
  };
  return state;
}

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

function prices() {
  const pricing = new PricingRegistry();
  pricing.register({
    provider: "openai",
    model: "gpt-4.1-mini",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    inputTokenRate: 1,
    outputTokenRate: 1,
  });
  return pricing;
}

test("quota exceeded -> AIQuotaExceededError with no provider call", async () => {
  const providers = adapter();
  const ai = createAIRuntime({
    providers: { openai: providers },
    prompts,
    pricing: prices(),
    usageStore: new MemoryUsageStore(),
  });
  await assert.rejects(
    () =>
      ai.run(feature({ quota: { perUser: "0/day" } }), {
        input: { subject: "invoice" },
        context,
      }),
    AIQuotaExceededError,
  );
  assert.equal(providers.calls, 0);
});

test("a user under the daily quota proceeds", async () => {
  const providers = adapter();
  const ai = createAIRuntime({
    providers: { openai: providers },
    prompts,
    pricing: prices(),
    usageStore: new MemoryUsageStore(),
  });
  const result = await ai.run(feature({ quota: { perUser: "2/day" } }), {
    input: { subject: "invoice" },
    context,
  });
  assert.equal(result.data.category, "billing");
  assert.equal(providers.calls, 1);
});

test("either a user quota or an organization quota can block the same feature", async () => {
  const userBlocked = adapter();
  const userRuntime = createAIRuntime({
    providers: { openai: userBlocked },
    prompts,
    pricing: prices(),
    usageStore: new MemoryUsageStore(),
  });
  await assert.rejects(
    () =>
      userRuntime.run(
        feature({ quota: { perUser: "0/day", perOrganization: "10/month" } }),
        { input: { subject: "invoice" }, context },
      ),
    AIQuotaExceededError,
  );

  const orgBlocked = adapter();
  const orgRuntime = createAIRuntime({
    providers: { openai: orgBlocked },
    prompts,
    pricing: prices(),
    usageStore: new MemoryUsageStore(),
  });
  await assert.rejects(
    () =>
      orgRuntime.run(
        feature({ quota: { perUser: "10/day", perOrganization: "0/month" } }),
        { input: { subject: "invoice" }, context },
      ),
    AIQuotaExceededError,
  );
  assert.equal(userBlocked.calls, 0);
  assert.equal(orgBlocked.calls, 0);
});

test("budget exceeded -> AIBudgetExceededError with no provider call", async () => {
  const providers = adapter();
  const ai = createAIRuntime({
    providers: { openai: providers },
    prompts,
    pricing: prices(),
    usageStore: new MemoryUsageStore(),
  });
  await assert.rejects(
    () =>
      ai.run(feature({ budget: { organizationMonthly: 0 } }), {
        input: { subject: "invoice" },
        context,
      }),
    AIBudgetExceededError,
  );
  assert.equal(providers.calls, 0);
});

test("an organization under budget proceeds and later spend is visible", async () => {
  const providers = adapter();
  const store = new MemoryUsageStore();
  const ai = createAIRuntime({
    providers: { openai: providers },
    prompts,
    pricing: prices(),
    usageStore: store,
  });
  const defined = feature({ budget: { organizationMonthly: 100, maxCostPerRun: 100 } });
  const first = await ai.run(defined, { input: { subject: "invoice" }, context });
  assert.equal(first.meta.estimatedCost, 6);
  const totals = await store.getOrganizationUsage("org-1", {
    start: new Date(Date.now() - 86_400_000),
    end: new Date(Date.now() + 86_400_000),
  });
  assert.equal(totals.estimatedCost, 6);

  await assert.rejects(
    () =>
      ai.run(feature({ budget: { organizationMonthly: 6 } }), {
        input: { subject: "invoice" },
        context,
      }),
    AIBudgetExceededError,
  );
  assert.equal(providers.calls, 1);
});

test("an unregistered price throws AIConfigurationError", async () => {
  const providers = adapter();
  const ai = createAIRuntime({
    providers: { openai: providers },
    prompts,
    pricing: new PricingRegistry(),
  });
  await assert.rejects(
    () => ai.run(feature(), { input: { subject: "invoice" }, context }),
    AIConfigurationError,
  );
});

test("missing prompt variables are rejected before the provider is called", async () => {
  const providers = adapter();
  const ai = createAIRuntime({
    providers: { openai: providers },
    prompts: strictPrompts,
    pricing: prices(),
  });
  await assert.rejects(
    () => ai.run(feature(), { input: { subject: "invoice" }, context }),
    AIInputValidationError,
  );
  assert.equal(providers.calls, 0);
});

test("an unregistered prompt throws AIConfigurationError before the provider call", async () => {
  const providers = adapter();
  const ai = createAIRuntime({
    providers: { openai: providers },
    prompts,
    pricing: prices(),
  });
  await assert.rejects(
    () =>
      ai.run(feature({ prompt: { id: "missing", version: "1.0.0" } }), {
        input: { subject: "invoice" },
        context,
      }),
    AIConfigurationError,
  );
  assert.equal(providers.calls, 0);
});
