import { AIConfigurationError, AIInputValidationError } from "../errors/ai-error.js";
import type { FeatureDefinition } from "../types/index.js";
import type { PromptRegistry } from "@devstitch/prompts";

export type ResolvedPrompt = {
  id: string;
  version: string;
  text: string;
  hash: string;
};

/**
 * Invalid prompt variables are an input failure (`AIInputValidationError`).
 * A missing prompt id or version is configuration (`AIConfigurationError`).
 */
export function resolvePrompt<Input, Output>(
  feature: FeatureDefinition<Input, Output>,
  input: Input,
  registry: PromptRegistry,
): ResolvedPrompt {
  const prompt = registry.get(feature.prompt.id, feature.prompt.version);
  if (prompt === undefined) {
    throw new AIConfigurationError(
      `Prompt "${feature.prompt.id}@${feature.prompt.version}" is not registered.`,
    );
  }
  const parsed = prompt.variables.safeParse(input);
  if (!parsed.success) {
    throw new AIInputValidationError(
      `Prompt "${feature.prompt.id}@${feature.prompt.version}" rejected its variables.`,
      { cause: parsed.error },
    );
  }
  return {
    id: prompt.id,
    version: prompt.version,
    text: prompt.render(parsed.data),
    hash: prompt.hash,
  };
}
