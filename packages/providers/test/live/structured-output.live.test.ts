/**
 * Live provider test. This file is not part of `pnpm test`.
 * Run it with `pnpm --filter @devstitch/providers test:live`.
 * It calls OpenAI and Anthropic and spends a small amount of API credit.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { AnthropicAdapter } from "../../dist/anthropic-adapter.js";
import { OpenAIAdapter } from "../../dist/openai-adapter.js";
import type { NormalizedUsage } from "../../dist/types.js";

const schema = z.object({
  answer: z.literal("pong"),
});

const prompt = "Return a structured object whose answer field is the string pong.";

function assertNormalizedUsage(usage: NormalizedUsage): void {
  assert.equal(typeof usage.inputTokens, "number");
  assert.equal(typeof usage.outputTokens, "number");
  assert.equal(typeof usage.totalTokens, "number");
  assert.ok(usage.inputTokens >= 0);
  assert.ok(usage.outputTokens >= 0);
  assert.ok(usage.totalTokens >= 0);
}

test("OpenAI structured output returns validated data and normalized usage", async () => {
  if (process.env.OPENAI_API_KEY === undefined || process.env.OPENAI_API_KEY === "") {
    throw new Error("OPENAI_API_KEY is required for this live test.");
  }

  const adapter = new OpenAIAdapter();
  const result = await adapter.generateStructured({
    prompt,
    schema,
    model: process.env.OPENAI_LIVE_MODEL ?? "gpt-4.1-mini",
    timeout: 30_000,
  });

  assert.deepEqual(result.data, { answer: "pong" });
  assert.equal(typeof result.finishReason, "string");
  assertNormalizedUsage(result.usage);
});

test("Anthropic structured output returns validated data and normalized usage", async () => {
  if (
    process.env.ANTHROPIC_API_KEY === undefined ||
    process.env.ANTHROPIC_API_KEY === ""
  ) {
    throw new Error("ANTHROPIC_API_KEY is required for this live test.");
  }

  const adapter = new AnthropicAdapter();
  const result = await adapter.generateStructured({
    prompt,
    schema,
    model: process.env.ANTHROPIC_LIVE_MODEL ?? "claude-haiku-4-5",
    timeout: 30_000,
  });

  assert.deepEqual(result.data, { answer: "pong" });
  assert.equal(typeof result.finishReason, "string");
  assertNormalizedUsage(result.usage);
});
