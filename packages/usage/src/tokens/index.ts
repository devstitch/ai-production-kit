/**
 * Normalized usage for one provider call.
 *
 * Cache fields stay absent when the provider does not report them. A missing
 * field does not mean zero cached tokens.
 */
export type NormalizedTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  totalTokens: number;
};

/**
 * Token counts plus the identity of the run that produced them.
 * `afterProviderCall` receives this record so later stages do not re-derive it.
 */
export type NormalizedUsageRecord = NormalizedTokenUsage & {
  provider: string;
  model: string;
  feature: string;
  userId: string;
  organizationId: string;
  timestamp: Date;
};

export function createUsageRecord(input: NormalizedUsageRecord): NormalizedUsageRecord {
  const record: NormalizedUsageRecord = {
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens: input.totalTokens,
    provider: input.provider,
    model: input.model,
    feature: input.feature,
    userId: input.userId,
    organizationId: input.organizationId,
    timestamp: input.timestamp,
  };
  if (input.cachedInputTokens !== undefined) {
    record.cachedInputTokens = input.cachedInputTokens;
  }
  if (input.cacheWriteTokens !== undefined) {
    record.cacheWriteTokens = input.cacheWriteTokens;
  }
  return record;
}
