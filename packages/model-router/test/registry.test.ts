import assert from "node:assert/strict";
import { test } from "node:test";
import { ModelRegistry, UnregisteredModelKeyError } from "../dist/index.js";

test("a logical key resolves to the environment-specific model", () => {
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

  assert.deepEqual(models.resolve("fast", "development"), {
    provider: "openai",
    model: "gpt-dev",
  });
  assert.deepEqual(models.resolve("fast", "production"), {
    provider: "openai",
    model: "gpt-prod",
  });
});

test("a provider:model string resolves without a registry entry", () => {
  const models = new ModelRegistry();
  assert.deepEqual(models.resolve("anthropic:claude-haiku-4-5", "production"), {
    provider: "anthropic",
    model: "claude-haiku-4-5",
  });
});

test("an unknown logical key is rejected by the registry", () => {
  const models = new ModelRegistry();
  assert.throws(() => models.resolve("missing", "development"), UnregisteredModelKeyError);
});
