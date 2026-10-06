import assert from "node:assert/strict";
import { test } from "node:test";
import { PricingRegistry, UnregisteredPriceError } from "../dist/index.js";

const usage = {
  provider: "openai",
  model: "gpt-test",
  inputTokens: 1_000_000,
  outputTokens: 2_000_000,
  totalTokens: 3_000_000,
};

test("a registered rate produces the expected estimated cost", () => {
  const pricing = new PricingRegistry();
  pricing.register({
    provider: "openai",
    model: "gpt-test",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    inputTokenRate: 0.000002,
    outputTokenRate: 0.000008,
  });
  const cost = pricing.estimate(usage, new Date("2026-06-01T00:00:00Z"));
  assert.equal(cost.isEstimate, true);
  assert.equal(cost.currency, "USD");
  assert.equal(cost.amount, 1_000_000 * 0.000002 + 2_000_000 * 0.000008);
});

test("the latest effective rate at or before the run is used", () => {
  const pricing = new PricingRegistry();
  pricing.register({
    provider: "openai",
    model: "gpt-test",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    inputTokenRate: 1,
    outputTokenRate: 1,
  });
  pricing.register({
    provider: "openai",
    model: "gpt-test",
    effectiveFrom: new Date("2026-05-01T00:00:00Z"),
    inputTokenRate: 2,
    outputTokenRate: 0,
  });
  const historical = pricing.estimate(usage, new Date("2026-02-01T00:00:00Z"));
  const current = pricing.estimate(usage, new Date("2026-06-01T00:00:00Z"));
  assert.equal(historical.amount, 3_000_000);
  assert.equal(current.amount, 2_000_000);
});

test("an unregistered provider and model throws instead of returning zero", () => {
  const pricing = new PricingRegistry();
  assert.throws(() => pricing.estimate(usage), UnregisteredPriceError);
});
