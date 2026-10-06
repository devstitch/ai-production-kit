import { AIConfigurationError } from "../errors/ai-error.js";
import type { FeatureDefinition } from "../types/index.js";
import { isZodSchema } from "./is-zod-schema.js";
import type { FeatureRegistry } from "./registry.js";

export function defineFeature<Input, Output>(
  definition: FeatureDefinition<Input, Output>,
  registry?: FeatureRegistry,
): FeatureDefinition<Input, Output> {
  if (typeof definition?.name !== "string" || definition.name.trim() === "") {
    throw new AIConfigurationError("Feature name is required.");
  }

  if (!isZodSchema(definition.input)) {
    throw new AIConfigurationError(
      `Feature "${definition.name}" is missing an input schema.`,
    );
  }

  if (!isZodSchema(definition.output)) {
    throw new AIConfigurationError(
      `Feature "${definition.name}" is missing an output schema.`,
    );
  }

  if (
    typeof definition.prompt?.id !== "string" ||
    definition.prompt.id.trim() === "" ||
    typeof definition.prompt.version !== "string" ||
    definition.prompt.version.trim() === ""
  ) {
    throw new AIConfigurationError(
      `Feature "${definition.name}" is missing a prompt id and version.`,
    );
  }

  if (
    typeof definition.model?.primary !== "string" ||
    definition.model.primary.trim() === ""
  ) {
    throw new AIConfigurationError(
      `Feature "${definition.name}" is missing a primary model.`,
    );
  }

  if (registry?.has(definition.name)) {
    throw new AIConfigurationError(
      `Feature "${definition.name}" is already registered.`,
    );
  }

  return definition;
}
