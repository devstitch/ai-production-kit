export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

export interface RateLimiter {
  check(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitDecision>;
}

export class MemoryRateLimiter implements RateLimiter {
  readonly #hits = new Map<string, number[]>();

  async check(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitDecision> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const recent = (this.#hits.get(key) ?? []).filter((hit) => now - hit < windowMs);
    if (recent.length >= limit) {
      const oldest = recent[0] ?? now;
      this.#hits.set(key, recent);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
      };
    }
    recent.push(now);
    this.#hits.set(key, recent);
    return { allowed: true };
  }
}

/**
 * Redis commands used by RedisRateLimiter. Pass an ioredis or node-redis
 * client. Redis is not required for local development; MemoryRateLimiter is
 * the default.
 */
export interface RedisRateLimitClient {
  incr(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
}

export class RedisRateLimiter implements RateLimiter {
  readonly #redis: RedisRateLimitClient;

  constructor(redis: RedisRateLimitClient) {
    this.#redis = redis;
  }

  async check(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitDecision> {
    const namespaced = `ai-production-kit:rate:${key}`;
    const count = await this.#redis.incr(namespaced);
    if (count === 1) {
      await this.#redis.pexpire(namespaced, windowSeconds * 1000);
    }
    if (count > limit) {
      const ttl = await this.#redis.pttl(namespaced);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(Math.max(ttl, 0) / 1000)),
      };
    }
    return { allowed: true };
  }
}

export const DEFAULT_RATE_LIMIT = {
  limit: 10,
  windowSeconds: 60,
} as const;

export type {
  PolicyHooks,
  ProviderCallHook,
  RunHookContext,
  UsageHookRecord,
} from "./hooks.js";
