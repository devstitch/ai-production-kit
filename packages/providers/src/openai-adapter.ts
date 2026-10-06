import { AIConfigurationError } from "@devstitch/core";
import { createOpenAI } from "@ai-sdk/openai";
import { createModelAdapter } from "./create-model-adapter.js";
import type {
  ProviderAdapter,
  StreamGenerationRequest,
  StreamGenerationResult,
  StructuredGenerationRequest,
  StructuredGenerationResult,
} from "./types.js";

export class OpenAIAdapter implements ProviderAdapter {
  readonly #adapter: ProviderAdapter;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (apiKey === undefined || apiKey.trim() === "") {
      throw new AIConfigurationError("OPENAI_API_KEY is not set.");
    }

    const openai = createOpenAI({ apiKey });
    this.#adapter = createModelAdapter((modelId) => openai(modelId));
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
