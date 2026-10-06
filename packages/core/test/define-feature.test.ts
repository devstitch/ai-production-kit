import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { AIConfigurationError } from "../dist/errors/ai-error.js";
import { defineFeature } from "../dist/feature/define-feature.js";
import { FeatureRegistry } from "../dist/feature/registry.js";
import type { FeatureDefinition } from "../src/types/index.ts";

const input = z.object({
  subject: z.string(),
});

const output = z.object({
  category: z.string(),
});

function feature(
  name: string,
  overrides: Partial<FeatureDefinition<unknown, unknown>> = {},
): FeatureDefinition<{ subject: string }, { category: string }> {
  return {
    name,
    input,
    output,
    prompt: { id: name, version: "1.0.0" },
    model: { primary: "fast" },
    ...overrides,
  };
}

test("defineFeature returns a feature that has input and output schemas", () => {
  const defined = defineFeature(feature("support-ticket-triage"));

  assert.equal(defined.name, "support-ticket-triage");
  assert.equal(defined.input, input);
  assert.equal(defined.output, output);
});

test("defineFeature rejects a feature missing an input schema", () => {
  assert.throws(
    () =>
      defineFeature(
        feature("support-ticket-triage", {
          input: undefined,
        }) as FeatureDefinition<unknown, unknown>,
      ),
    AIConfigurationError,
  );
});

test("defineFeature rejects a feature missing an output schema", () => {
  assert.throws(
    () =>
      defineFeature(
        feature("support-ticket-triage", {
          output: undefined,
        }) as FeatureDefinition<unknown, unknown>,
      ),
    AIConfigurationError,
  );
});

test("a registry rejects a duplicate feature name", () => {
  const registry = new FeatureRegistry();
  registry.register(feature("support-ticket-triage"));

  assert.throws(
    () => registry.register(feature("support-ticket-triage")),
    AIConfigurationError,
  );
  assert.equal(registry.list().length, 1);
});

test("defineFeature rejects a name that is already in the provided registry", () => {
  const registry = new FeatureRegistry();
  registry.register(feature("support-ticket-triage"));

  assert.throws(
    () => defineFeature(feature("support-ticket-triage"), registry),
    AIConfigurationError,
  );
});

test("the same feature name can be registered in a different registry", () => {
  const first = new FeatureRegistry();
  const second = new FeatureRegistry();
  const defined = feature("support-ticket-triage");

  first.register(defined);
  second.register(defined);

  assert.equal(first.get("support-ticket-triage").name, defined.name);
  assert.equal(second.get("support-ticket-triage").name, defined.name);
});
