import { AIConfigurationError } from "../errors/ai-error.js";
import type { RunContext } from "../types/index.js";

export function attachContext(context: RunContext): RunContext {
  if (context.userId.trim() === "" || context.organizationId.trim() === "") {
    throw new AIConfigurationError(
      "A run requires userId and organizationId.",
    );
  }
  return context;
}

export function resolveEnvironment(context: RunContext): string {
  return context.environment ?? process.env.NODE_ENV ?? "development";
}
