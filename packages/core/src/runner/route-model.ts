import {
  ModelRegistry,
  UnregisteredModelKeyError,
  type ResolvedModel,
} from "@devstitch/model-router";
import { AIConfigurationError } from "../errors/ai-error.js";

export function routeModel(
  ref: string,
  environment: string,
  models: ModelRegistry,
): ResolvedModel {
  try {
    return models.resolve(ref, environment);
  } catch (error) {
    if (error instanceof UnregisteredModelKeyError) {
      throw new AIConfigurationError(error.message, { cause: error });
    }
    throw error;
  }
}
