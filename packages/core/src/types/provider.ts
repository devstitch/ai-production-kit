import type { ZodSchema } from "zod";

export type NormalizedUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  totalTokens: number;
};

export type StructuredGenerationRequest<T> = {
  prompt: string;
  schema: ZodSchema<T>;
  model: string;
  timeout?: number;
  abortSignal?: AbortSignal;
};

export type StructuredGenerationResult<T> = {
  data: T;
  usage: NormalizedUsage;
  finishReason: string;
};

export type StreamGenerationRequest = {
  prompt: string;
  model: string;
  timeout?: number;
  abortSignal?: AbortSignal;
};

export type StreamCompletion = {
  usage: NormalizedUsage;
  finishReason: string;
};

export type StreamGenerationResult = {
  stream: AsyncIterable<string>;
  completion: Promise<StreamCompletion>;
};

export interface ProviderAdapter {
  generateStructured<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<StructuredGenerationResult<T>>;
  generateStream(request: StreamGenerationRequest): StreamGenerationResult;
}
