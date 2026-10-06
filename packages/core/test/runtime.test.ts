import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import {
  AIAuthenticationError,
  AIConfigurationError,
  AIInputValidationError,
  AIProviderUnavailableError,
  AIRateLimitExceededError,
  AITimeoutError,
} from "../dist/errors/ai-error.js";
import {
  createAIRuntime as createRuntime,
  type AIRuntimeOptions,
} from "../dist/runner/create-runtime.js";
import type { ProviderAdapter } from "../dist/types/provider.js";
import { ModelRegistry } from "@devstitch/model-router";
import { MemoryRateLimiter } from "@devstitch/policies";
import { definePrompt, PromptRegistry } from "@devstitch/prompts";
import { createExamplePricing } from "@devstitch/usage";

const inputSchema = z.object({ subject: z.string() });
const outputSchema = z.object({ category: z.string() });

const testPrompts = new PromptRegistry();
definePrompt(
  {
    id: "support-ticket-triage",
    version: "1.0.0",
    variables: inputSchema,
    render: (input) => `Subject: ${input.subject}`,
  },
  testPrompts,
);
const testPricing = createExamplePricing();
testPricing.register({
  provider: "openai",
  model: "gpt-dev",
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  inputTokenRate: 0.01,
  outputTokenRate: 0.02,
});
testPricing.register({
  provider: "openai",
  model: "gpt-prod",
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  inputTokenRate: 0.01,
  outputTokenRate: 0.02,
});

function createAIRuntime(options: AIRuntimeOptions) {
  return createRuntime({ prompts: testPrompts, pricing: testPricing, ...options });
}

const usage = { inputTokens: 4, outputTokens: 2, totalTokens: 6 };

function feature(overrides: Record<string, unknown> = {}) {
  return {
    name: "support-ticket-triage",
    input: inputSchema,
    output: outputSchema,
    prompt: { id: "support-ticket-triage", version: "1.0.0" },
    model: { primary: "openai:gpt-4.1-mini" },
    timeout: 1000,
    ...overrides,
  };
}

function successAdapter(): ProviderAdapter & { calls: number; models: string[]; aborted: boolean } {
  const adapter = {
    calls: 0,
    models: [] as string[],
    aborted: false,
    async generateStructured(request: { model: string; abortSignal?: AbortSignal }) {
      adapter.calls += 1;
      adapter.models.push(request.model);
      request.abortSignal?.addEventListener("abort", () => {
        adapter.aborted = true;
      });
      return {
        data: { category: "billing" },
        usage,
        finishReason: "stop",
      };
    },
    generateStream() {
      throw new Error("stream is not used");
    },
  };
  return adapter;
}

const context = { userId: "user-1", organizationId: "org-1" };

test("invalid input is rejected before the provider is called", async () => {
  const adapter = successAdapter();
  const ai = createAIRuntime({
    providers: { openai: adapter },
    rateLimiter: new MemoryRateLimiter(),
  });

  await assert.rejects(
    () => ai.run(feature(), { input: { subject: 12 }, context }),
    AIInputValidationError,
  );
  assert.equal(adapter.calls, 0);
});

test("a slow provider times out and the abort signal fires", async () => {
  const adapter: ProviderAdapter & { calls: number; aborted: boolean } = {
    calls: 0,
    aborted: false,
    generateStructured(request) {
      adapter.calls += 1;
      return new Promise((_resolve, reject) => {
        request.abortSignal?.addEventListener("abort", () => {
          adapter.aborted = true;
          reject(new Error("aborted"));
        });
      });
    },
    generateStream() {
      throw new Error("stream is not used");
    },
  };
  const ai = createAIRuntime({
    providers: { openai: adapter },
    rateLimiter: new MemoryRateLimiter(),
  });

  await assert.rejects(
    () =>
      ai.run(feature({ timeout: 20 }), {
        input: { subject: "invoice" },
        context,
      }),
    AITimeoutError,
  );
  assert.equal(adapter.aborted, true);
});

test("a transient provider failure is retried and attempts counts every call", async () => {
  let calls = 0;
  const adapter: ProviderAdapter = {
    async generateStructured() {
      calls += 1;
      if (calls < 3) {
        throw new AIProviderUnavailableError("upstream unavailable");
      }
      return { data: { category: "billing" }, usage, finishReason: "stop" };
    },
    generateStream() {
      throw new Error("stream is not used");
    },
  };
  const ai = createAIRuntime({
    providers: { openai: adapter },
    rateLimiter: new MemoryRateLimiter(),
    sleep: async () => undefined,
  });

  const result = await ai.run(
    feature({
      retries: { attempts: 2, backoff: "fixed", maxDelayMs: 0 },
    }),
    { input: { subject: "invoice" }, context },
  );

  assert.equal(result.meta.attempts, 3);
  assert.equal(calls, 3);
  assert.equal(result.data.category, "billing");
});

test("an authentication error is not retried", async () => {
  let calls = 0;
  const adapter: ProviderAdapter = {
    async generateStructured() {
      calls += 1;
      throw new AIAuthenticationError("bad key");
    },
    generateStream() {
      throw new Error("stream is not used");
    },
  };
  const ai = createAIRuntime({
    providers: { openai: adapter },
    rateLimiter: new MemoryRateLimiter(),
    sleep: async () => undefined,
  });

  const error = await ai
    .run(
      feature({ retries: { attempts: 4, backoff: "fixed", maxDelayMs: 0 } }),
      { input: { subject: "invoice" }, context },
    )
    .catch((caught: unknown) => caught);

  assert.ok(error instanceof AIAuthenticationError);
  assert.equal(error.runMeta?.attempts, 1);
  assert.equal(calls, 1);
});

test("an eligible primary failure falls back and stays visible to telemetry", async () => {
  const events: Array<{ type: string; fallbackUsed?: boolean }> = [];
  const primary: ProviderAdapter & { calls: number } = {
    calls: 0,
    async generateStructured() {
      primary.calls += 1;
      throw new AITimeoutError("timed out");
    },
    generateStream() {
      throw new Error("stream is not used");
    },
  };
  const fallback: ProviderAdapter & { calls: number } = {
    calls: 0,
    async generateStructured() {
      fallback.calls += 1;
      return { data: { category: "technical" }, usage, finishReason: "stop" };
    },
    generateStream() {
      throw new Error("stream is not used");
    },
  };
  const ai = createAIRuntime({
    providers: { openai: primary, anthropic: fallback },
    rateLimiter: new MemoryRateLimiter(),
    telemetry: { record: (event) => events.push(event) },
  });

  const result = await ai.run(
    feature({
      model: {
        primary: "openai:gpt-4.1-mini",
        fallback: "anthropic:claude-haiku-4-5",
      },
    }),
    { input: { subject: "outage" }, context },
  );

  assert.equal(result.meta.fallbackUsed, true);
  assert.deepEqual(result.meta.providerAttempts, [
    { provider: "openai", status: "timeout" },
    { provider: "anthropic", status: "success" },
  ]);
  assert.equal(primary.calls, 1);
  assert.equal(fallback.calls, 1);
  assert.ok(events.some((event) => event.type === "provider_failure"));
});

test("an authentication failure does not call the fallback provider", async () => {
  const fallback: ProviderAdapter & { calls: number } = {
    calls: 0,
    async generateStructured() {
      fallback.calls += 1;
      return { data: { category: "technical" }, usage, finishReason: "stop" };
    },
    generateStream() {
      throw new Error("stream is not used");
    },
  };
  const ai = createAIRuntime({
    providers: {
      openai: {
        async generateStructured() {
          throw new AIAuthenticationError("bad key");
        },
        generateStream() {
          throw new Error("stream is not used");
        },
      },
      anthropic: fallback,
    },
    rateLimiter: new MemoryRateLimiter(),
  });

  await assert.rejects(
    () =>
      ai.run(
        feature({
          model: {
            primary: "openai:gpt-4.1-mini",
            fallback: "anthropic:claude-haiku-4-5",
          },
        }),
        { input: { subject: "invoice" }, context },
      ),
    AIAuthenticationError,
  );
  assert.equal(fallback.calls, 0);
});

test("a rate limit blocks the provider call", async () => {
  const adapter = successAdapter();
  const ai = createAIRuntime({
    providers: { openai: adapter },
    rateLimiter: new MemoryRateLimiter(),
  });

  await assert.rejects(
    () =>
      ai.run(feature({ rateLimit: { limit: 0, windowSeconds: 60 } }), {
        input: { subject: "invoice" },
        context,
      }),
    AIRateLimitExceededError,
  );
  assert.equal(adapter.calls, 0);
});

test("logical models resolve differently in development and production", async () => {
  const models = new ModelRegistry();
  models.register({
    key: "fast",
    provider: "openai",
    model: "gpt-dev",
    environment: "development",
  });
  models.register({
    key: "fast",
    provider: "openai",
    model: "gpt-prod",
    environment: "production",
  });
  const adapter = successAdapter();
  const ai = createAIRuntime({
    providers: { openai: adapter },
    models,
    rateLimiter: new MemoryRateLimiter(),
  });
  const defined = feature({ model: { primary: "fast" } });

  await ai.run(defined, {
    input: { subject: "invoice" },
    context: { ...context, environment: "development" },
  });
  await ai.run(defined, {
    input: { subject: "invoice" },
    context: { ...context, userId: "user-2", environment: "production" },
  });

  assert.deepEqual(adapter.models, ["gpt-dev", "gpt-prod"]);
});

test("an unregistered model key throws AIConfigurationError before the provider call", async () => {
  const adapter = successAdapter();
  const ai = createAIRuntime({
    providers: { openai: adapter },
    rateLimiter: new MemoryRateLimiter(),
  });

  await assert.rejects(
    () =>
      ai.run(feature({ model: { primary: "missing" } }), {
        input: { subject: "invoice" },
        context,
      }),
    AIConfigurationError,
  );
  assert.equal(adapter.calls, 0);
});

test("stream yields chunks and then resolves meta", async () => {
  const streaming: ProviderAdapter = {
    async generateStructured() {
      throw new Error("structured is not used");
    },
    generateStream() {
      return {
        stream: (async function* () {
          yield "Hello";
          yield " there";
        })(),
        completion: Promise.resolve({ usage, finishReason: "stop" }),
      };
    },
  };
  const ai = createAIRuntime({
    providers: { openai: streaming },
    rateLimiter: new MemoryRateLimiter(),
  });
  const run = await ai.stream(feature({ output: z.string() }), {
    input: { subject: "invoice" },
    context,
  });
  let text = "";
  for await (const chunk of run) {
    text += chunk;
  }
  const meta = await run.meta;
  assert.equal(text, "Hello there");
  assert.equal(meta.finishReason, "stop");
  assert.equal(meta.inputTokens, 4);
  assert.equal(typeof meta.timeToFirstTokenMs, "number");
  assert.equal(meta.promptVersion, "1.0.0");
});
