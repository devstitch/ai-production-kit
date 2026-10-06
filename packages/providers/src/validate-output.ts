import { AIOutputValidationError } from "@devstitch/core";
import type { ZodSchema } from "zod";

export function validateStructuredOutput<T>(
  schema: ZodSchema<T>,
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AIOutputValidationError(
      "Model output did not match the output schema.",
      { cause: parsed.error },
    );
  }

  return parsed.data;
}
