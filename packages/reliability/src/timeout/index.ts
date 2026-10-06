export class ProviderTimeoutError extends Error {
  readonly code = "ai_timeout" as const;

  constructor() {
    super("The provider call exceeded the configured timeout.");
    this.name = "ProviderTimeoutError";
  }
}

export const DEFAULT_TIMEOUT_MS = 15_000;

export async function withTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new ProviderTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([run(controller.signal), timeout]);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ProviderTimeoutError();
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
