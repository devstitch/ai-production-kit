import { AIExecutionError } from "@devstitch/core";
import type { NormalizedUsage } from "./types.js";

export type ProviderUsage = {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  totalTokens?: number | undefined;
  inputTokenDetails?: {
    cacheReadTokens?: number | undefined;
    cacheWriteTokens?: number | undefined;
  };
};

export function normalizeUsage(usage: ProviderUsage): NormalizedUsage {
  if (usage.inputTokens === undefined || usage.outputTokens === undefined) {
    throw new AIExecutionError(
      "The provider did not report input and output token usage.",
    );
  }

  const normalized: NormalizedUsage = {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens:
      usage.totalTokens ?? usage.inputTokens + usage.outputTokens,
  };

  const cachedInputTokens = usage.inputTokenDetails?.cacheReadTokens;
  if (cachedInputTokens !== undefined) {
    normalized.cachedInputTokens = cachedInputTokens;
  }

  const cacheWriteTokens = usage.inputTokenDetails?.cacheWriteTokens;
  if (cacheWriteTokens !== undefined) {
    normalized.cacheWriteTokens = cacheWriteTokens;
  }

  return normalized;
}
