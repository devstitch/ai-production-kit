import { AIConfigurationError } from "@devstitch/core";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createModelAdapter } from "./create-model-adapter.js";
import type {
  ProviderAdapter,
  StreamGenerationRequest,
  StreamGenerationResult,
  StructuredGenerationRequest,
  StructuredGenerationResult,
} from "./types.js";

export class AnthropicAdapter implements ProviderAdapter {
  readonly #adapter: ProviderAdapter;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    if (apiKey === undefined || apiKey.trim() === "") {
      throw new AIConfigurationError("ANTHROPIC_API_KEY is not set.");
    }

    const anthropic = createAnthropic({ apiKey });
    this.#adapter = createModelAdapter((modelId) => anthropic(modelId));
  }

  generateStructured<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<StructuredGenerationResult<T>> {
    return this.#adapter.generateStructured(request);
  }

  generateStream(request: StreamGenerationRequest): StreamGenerationResult {
    return this.#adapter.generateStream(request);
  }
}
