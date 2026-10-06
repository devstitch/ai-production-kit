import assert from "node:assert/strict";
import { test } from "node:test";
import { createTelemetry, otlpPayload } from "../dist/index.js";

test("the dev exporter records a span without requiring an OTLP endpoint", () => {
  const lines: string[] = [];
  const telemetry = createTelemetry({ write: (line) => lines.push(line), otlpEndpoint: "" });
  telemetry.record({
    type: "run",
    feature: "support-ticket-triage",
    runId: "run-1",
    attributes: { "ai.feature.name": "support-ticket-triage", "ai.fallback.used": false },
  });
  assert.equal(telemetry.spans.length, 1);
  assert.match(lines[0] ?? "", /support-ticket-triage/);
});

test("an OTLP payload carries the span attributes", () => {
  const payload = otlpPayload({
    type: "run",
    feature: "support-ticket-triage",
    runId: "run-1",
    attributes: { "gen_ai.provider.name": "openai", "ai.cost.estimated": 0.02 },
  });
  const attributes = payload.resourceSpans[0]?.scopeSpans[0]?.spans[0]?.attributes ?? [];
  assert.equal(attributes.some((item) => item.key === "gen_ai.provider.name"), true);
  assert.equal(attributes.some((item) => item.key === "ai.cost.estimated"), true);
});
