import assert from "node:assert/strict";
import { test } from "node:test";
import { AIOutputValidationError } from "@devstitch/core";
import { z } from "zod";
import { validateStructuredOutput } from "../dist/validate-output.js";

const schema = z.object({
  answer: z.literal("pong"),
});

test("validateStructuredOutput returns the parsed object", () => {
  const data = validateStructuredOutput(schema, { answer: "pong" });
  assert.deepEqual(data, { answer: "pong" });
});

test("validateStructuredOutput rejects malformed model output", () => {
  assert.throws(
    () => validateStructuredOutput(schema, { answer: "ping" }),
    AIOutputValidationError,
  );
});
