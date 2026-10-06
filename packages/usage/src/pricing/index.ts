import type { NormalizedTokenUsage } from "../tokens/index.js";

/**
 * USD per token. These are configuration, not invoices.
 * `effectiveFrom` selects the latest rate whose start is at or before the run.
 */
export type PriceRate = {
  provider: string;
  model: string;
  effectiveFrom: Date;
  inputTokenRate: number;
  outputTokenRate: number;
  cachedInputTokenRate?: number;
  cacheWriteTokenRate?: number;
};

export type EstimatedCost = {
  /** USD. An estimate, not a provider invoice. */
  amount: number;
  currency: "USD";
  isEstimate: true;
  provider: string;
  model: string;
};

export class UnregisteredPriceError extends Error {
  readonly code = "ai_configuration" as const;
  readonly provider: string;
  readonly model: string;

  constructor(provider: string, model: string) {
    super(`No price is registered for ${provider}/${model}.`);
    this.name = "UnregisteredPriceError";
    this.provider = provider;
    this.model = model;
  }
}

export type PricedUsage = NormalizedTokenUsage & {
  provider: string;
  model: string;
};

export class PricingRegistry {
  readonly #rates: PriceRate[] = [];

  register(rate: PriceRate): void {
    this.#rates.push(rate);
  }

  estimate(usage: PricedUsage, at: Date = new Date()): EstimatedCost {
    const candidates = this.#rates.filter(
      (rate) =>
        rate.provider === usage.provider &&
        rate.model === usage.model &&
        rate.effectiveFrom.getTime() <= at.getTime(),
    );
    const selected = candidates.sort(
      (left, right) => right.effectiveFrom.getTime() - left.effectiveFrom.getTime(),
    )[0];
    if (selected === undefined) {
      throw new UnregisteredPriceError(usage.provider, usage.model);
    }

    const cached =
      usage.cachedInputTokens === undefined
        ? 0
        : usage.cachedInputTokens * (selected.cachedInputTokenRate ?? 0);
    const cacheWrite =
      usage.cacheWriteTokens === undefined
        ? 0
        : usage.cacheWriteTokens * (selected.cacheWriteTokenRate ?? 0);
    const amount =
      usage.inputTokens * selected.inputTokenRate +
      usage.outputTokens * selected.outputTokenRate +
      cached +
      cacheWrite;

    return {
      amount,
      currency: "USD",
      isEstimate: true,
      provider: usage.provider,
      model: usage.model,
    };
  }
}

/**
 * Illustrative rates in USD per token for the models used by the examples.
 * Real provider prices change. Register current rates in application code.
 */
export function createExamplePricing(now: Date = new Date("2026-01-01T00:00:00Z")): PricingRegistry {
  const pricing = new PricingRegistry();
  pricing.register({
    provider: "openai",
    model: "gpt-4.1-mini",
    effectiveFrom: now,
    inputTokenRate: 0.4 / 1_000_000,
    outputTokenRate: 1.6 / 1_000_000,
  });
  pricing.register({
    provider: "anthropic",
    model: "claude-haiku-4-5",
    effectiveFrom: now,
    inputTokenRate: 1 / 1_000_000,
    outputTokenRate: 5 / 1_000_000,
  });
  return pricing;
}
