# Reliability

Timeouts, retries, and provider fallback are separate decisions.

## Timeout

Every run has a timeout. A feature can set `timeout` in milliseconds. When it does not, the runtime uses 15 seconds. The timer aborts the provider request. The run then fails with `AITimeoutError`, and `meta.timedOut` is true on that error's `runMeta`.

## Retries

`isRetryable` allows another attempt on the same provider only for transient failures:

- timeout
- provider unavailable
- provider rate limit
- connection failures
- HTTP 429 and HTTP 5xx causes

It refuses another attempt for authentication, invalid input, invalid output, configuration, quota, budget, and the application's own rate limit.

`feature.retries.attempts` is the number of extra attempts after the first call. `meta.attempts` is the number of provider calls actually made. Two transient failures followed by success is `meta.attempts === 3` when `retries.attempts` is 2.

Exponential backoff waits longer on each retry, adds jitter, and never waits longer than `maxDelayMs`.

## Fallback

Fallback is not the same list as retry. `isFallbackEligible` allows a second provider only for timeout, provider unavailable, provider rate limit, HTTP 429, and HTTP 5xx. Authentication, invalid input, invalid output, and configuration errors stop the run. The primary failure is still recorded through telemetry when a fallback succeeds.

`meta.fallbackUsed` is true when the second provider produced the result. `meta.providerAttempts` lists each provider and its status, for example `timeout` then `success`. `meta.attempts` remains the call count.

Set `SIMULATE_PRIMARY_FAILURE=true`, or pass `simulatePrimaryFailure: true` to `createAIRuntime`, to force the primary provider to fail with `AIProviderUnavailableError` before it is called. The fallback provider is not simulated.
