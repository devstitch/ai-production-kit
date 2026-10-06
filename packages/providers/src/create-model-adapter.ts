import { generateText, Output, streamText, type LanguageModel } from "ai";
import { normalizeProviderError } from "./normalize-provider-error.js";
import { normalizeUsage } from "./normalize-usage.js";
import type {
  ProviderAdapter,
  StreamGenerationRequest,
  StructuredGenerationRequest,
} from "./types.js";
import { validateStructuredOutput } from "./validate-output.js";

function abortSignalFor(request: {
  timeout?: number;
  abortSignal?: AbortSignal;
}): AbortSignal | undefined {
  const signals: AbortSignal[] = [];
  if (request.abortSignal !== undefined) {
    signals.push(request.abortSignal);
  }
  if (request.timeout !== undefined) {
    signals.push(AbortSignal.timeout(request.timeout));
  }
  if (signals.length === 0) {
    return undefined;
  }
  if (signals.length === 1) {
    return signals[0];
  }
  return AbortSignal.any(signals);
}

export function createModelAdapter(
  createModel: (modelId: string) => LanguageModel,
): ProviderAdapter {
  return {
    async generateStructured<T>(request: StructuredGenerationRequest<T>) {
      try {
        const result = await generateText({
          model: createModel(request.model),
          prompt: request.prompt,
          output: Output.object({ schema: request.schema }),
          abortSignal: abortSignalFor(request),
          maxRetries: 0,
        });

        return {
          data: validateStructuredOutput(request.schema, result.output),
          usage: normalizeUsage(result.usage),
          finishReason: result.finishReason,
        };
      } catch (error) {
        throw normalizeProviderError(error);
      }
    },

    generateStream(request: StreamGenerationRequest) {
      try {
        const result = streamText({
          model: createModel(request.model),
          prompt: request.prompt,
          abortSignal: abortSignalFor(request),
          maxRetries: 0,
        });

        return {
          stream: result.textStream,
          completion: Promise.all([result.usage, result.finishReason])
            .then(([usage, finishReason]) => ({
              usage: normalizeUsage(usage),
              finishReason,
            }))
            .catch((error: unknown) => {
              throw normalizeProviderError(error);
            }),
        };
      } catch (error) {
        throw normalizeProviderError(error);
      }
    },
  };
}
