/**
 * Small pipeline hooks. This is not a workflow engine.
 * `afterProviderCall` receives the normalized usage record from the runner.
 */
export type UsageHookRecord = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  totalTokens: number;
  provider: string;
  model: string;
  feature: string;
  userId: string;
  organizationId: string;
  timestamp: Date;
};

export type RunHookContext = {
  runId: string;
  feature: string;
  userId: string;
  organizationId: string;
};

export type ProviderCallHook = RunHookContext & {
  provider: string;
  model: string;
};

export type PolicyHooks = {
  beforeRun?: (context: RunHookContext) => void | Promise<void>;
  beforeProviderCall?: (context: ProviderCallHook) => void | Promise<void>;
  afterProviderCall?: (
    context: RunHookContext & { usage: UsageHookRecord },
  ) => void | Promise<void>;
  afterRun?: (context: RunHookContext) => void | Promise<void>;
  onError?: (context: RunHookContext & { error: unknown }) => void | Promise<void>;
};
