export type RunStatus = "success" | "failure";

/**
 * One ledger row. Raw prompt text and model output are intentionally absent.
 */
export type StoredRun = {
  id: string;
  featureName: string;
  userId: string;
  organizationId: string;
  provider: string;
  model: string;
  promptId: string;
  promptVersion: string;
  promptHash: string;
  status: RunStatus;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  estimatedCost: number;
  latencyMs: number;
  timeToFirstTokenMs?: number;
  /** Extra provider calls after the first. Zero means the first call was the only one. */
  retryCount: number;
  fallbackUsed: boolean;
  errorType?: string;
  traceId: string;
  createdAt: Date;
};

export type UsageWindow = {
  start: Date;
  end: Date;
  feature?: string;
};

export type UsageTotals = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
};

export type RunFilter = {
  feature?: string;
  provider?: string;
  model?: string;
  organizationId?: string;
  userId?: string;
  promptVersion?: string;
  since?: Date;
  until?: Date;
};

export type UsageSummary = {
  runs: number;
  tokens: number;
  estimatedCost: number;
  successRate: number;
  averageLatencyMs: number;
  fallbackCount: number;
};

export interface UsageStore {
  record(run: StoredRun): Promise<void>;
  getUserUsage(userId: string, organizationId: string, window: UsageWindow): Promise<UsageTotals>;
  getOrganizationUsage(organizationId: string, window: UsageWindow): Promise<UsageTotals>;
  /** Feature granularity for budgets. Added beside the Prompt 13 methods. */
  getFeatureUsage(feature: string, organizationId: string, window: UsageWindow): Promise<UsageTotals>;
  listRuns(filter?: RunFilter): Promise<StoredRun[]>;
  summarize(filter?: RunFilter): Promise<UsageSummary>;
}

export function emptyTotals(): UsageTotals {
  return {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  };
}

export function summarizeRuns(runs: readonly StoredRun[]): UsageSummary {
  if (runs.length === 0) {
    return {
      runs: 0,
      tokens: 0,
      estimatedCost: 0,
      successRate: 0,
      averageLatencyMs: 0,
      fallbackCount: 0,
    };
  }
  const successes = runs.filter((run) => run.status === "success").length;
  const latency = runs.reduce((sum, run) => sum + run.latencyMs, 0);
  return {
    runs: runs.length,
    tokens: runs.reduce((sum, run) => sum + run.inputTokens + run.outputTokens, 0),
    estimatedCost: runs.reduce((sum, run) => sum + run.estimatedCost, 0),
    successRate: successes / runs.length,
    averageLatencyMs: latency / runs.length,
    fallbackCount: runs.filter((run) => run.fallbackUsed).length,
  };
}

export function matchesFilter(run: StoredRun, filter: RunFilter = {}): boolean {
  if (filter.feature !== undefined && run.featureName !== filter.feature) return false;
  if (filter.provider !== undefined && run.provider !== filter.provider) return false;
  if (filter.model !== undefined && run.model !== filter.model) return false;
  if (filter.organizationId !== undefined && run.organizationId !== filter.organizationId) {
    return false;
  }
  if (filter.userId !== undefined && run.userId !== filter.userId) return false;
  if (filter.promptVersion !== undefined && run.promptVersion !== filter.promptVersion) {
    return false;
  }
  if (filter.since !== undefined && run.createdAt.getTime() < filter.since.getTime()) return false;
  if (filter.until !== undefined && run.createdAt.getTime() >= filter.until.getTime()) return false;
  return true;
}

export function totalsFor(runs: readonly StoredRun[]): UsageTotals {
  return {
    requests: runs.length,
    inputTokens: runs.reduce((sum, run) => sum + run.inputTokens, 0),
    outputTokens: runs.reduce((sum, run) => sum + run.outputTokens, 0),
    totalTokens: runs.reduce((sum, run) => sum + run.inputTokens + run.outputTokens, 0),
    estimatedCost: runs.reduce((sum, run) => sum + run.estimatedCost, 0),
  };
}

export function inWindow(run: StoredRun, window: UsageWindow): boolean {
  const time = run.createdAt.getTime();
  if (time < window.start.getTime() || time > window.end.getTime()) return false;
  if (window.feature !== undefined && run.featureName !== window.feature) return false;
  return true;
}
