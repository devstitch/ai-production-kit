import { AIInputValidationError } from "../errors/ai-error.js";
import type { FeatureDefinition } from "../types/index.js";

export function validateInput<Input, Output>(
  feature: FeatureDefinition<Input, Output>,
  input: unknown,
): Input {
  const parsed = feature.input.safeParse(input);
  if (!parsed.success) {
    throw new AIInputValidationError(
      `Feature "${feature.name}" rejected its input.`,
      { cause: parsed.error },
    );
  }
  return parsed.data;
}
