import { UnregisteredPriceError, type PricingRegistry, type PricedUsage } from "@devstitch/usage";
import { AIConfigurationError } from "../errors/ai-error.js";

export function estimateRunCost(pricing: PricingRegistry, usage: PricedUsage, at?: Date): number {
  try {
    return pricing.estimate(usage, at).amount;
  } catch (error) {
    if (error instanceof UnregisteredPriceError) {
      throw new AIConfigurationError(error.message, { cause: error });
    }
    throw error;
  }
}
