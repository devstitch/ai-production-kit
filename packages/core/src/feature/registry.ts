import { AIConfigurationError } from "../errors/ai-error.js";
import type { FeatureDefinition } from "../types/index.js";
import { defineFeature } from "./define-feature.js";

export class FeatureRegistry {
  readonly #features = new Map<string, FeatureDefinition<unknown, unknown>>();

  register<Input, Output>(feature: FeatureDefinition<Input, Output>): void {
    defineFeature(feature, this);
    this.#features.set(feature.name, feature);
  }

  has(name: string): boolean {
    return this.#features.has(name);
  }

  get(name: string): FeatureDefinition<unknown, unknown> {
    const feature = this.#features.get(name);
    if (feature === undefined) {
      throw new AIConfigurationError(`Feature "${name}" is not registered.`);
    }
    return feature;
  }

  list(): FeatureDefinition<unknown, unknown>[] {
    return [...this.#features.values()];
  }
}
