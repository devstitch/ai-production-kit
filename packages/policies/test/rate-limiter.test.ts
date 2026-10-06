import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryRateLimiter, RedisRateLimiter } from "../dist/index.js";

test("the in-memory limiter blocks once the window is full", async () => {
  const limiter = new MemoryRateLimiter();
  const first = await limiter.check("user:org:feature", 1, 60);
  const second = await limiter.check("user:org:feature", 1, 60);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.equal(typeof second.retryAfterSeconds, "number");
});

test("the redis limiter uses incr and expiry", async () => {
  const keys = new Map<string, { count: number; ttl: number }>();
  const limiter = new RedisRateLimiter({
    async incr(key) {
      const current = keys.get(key) ?? { count: 0, ttl: 60_000 };
      current.count += 1;
      keys.set(key, current);
      return current.count;
    },
    async pexpire(key, milliseconds) {
      const current = keys.get(key);
      if (current !== undefined) {
        current.ttl = milliseconds;
      }
    },
    async pttl(key) {
      return keys.get(key)?.ttl ?? -1;
    },
  });

  assert.equal((await limiter.check("user", 1, 60)).allowed, true);
  const blocked = await limiter.check("user", 1, 60);
  assert.equal(blocked.allowed, false);
  assert.ok((blocked.retryAfterSeconds ?? 0) > 0);
});
