import type { RunResultMeta } from "../types/index.js";

export type AIErrorCode =
  | "ai_input_validation"
  | "ai_output_validation"
  | "ai_authentication"
  | "ai_provider_rate_limit"
  | "ai_quota_exceeded"
  | "ai_budget_exceeded"
  | "ai_timeout"
  | "ai_provider_unavailable"
  | "ai_configuration"
  | "ai_execution"
  | "ai_rate_limit_exceeded";

type AIErrorOptions = {
  code: AIErrorCode;
  retryable: boolean;
  cause?: unknown;
};

export abstract class AIError extends Error {
  readonly code: AIErrorCode;
  readonly retryable: boolean;
  runMeta?: RunResultMeta;

  constructor(message: string, options: AIErrorOptions) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = new.target.name;
    this.code = options.code;
    this.retryable = options.retryable;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AIInputValidationError extends AIError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, {
      code: "ai_input_validation",
      retryable: false,
      cause: options?.cause,
    });
  }
}

export class AIOutputValidationError extends AIError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, {
      code: "ai_output_validation",
      retryable: false,
      cause: options?.cause,
    });
  }
}

export class AIAuthenticationError extends AIError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, {
      code: "ai_authentication",
      retryable: false,
      cause: options?.cause,
    });
  }
}

export class AIProviderRateLimitError extends AIError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, {
      code: "ai_provider_rate_limit",
      retryable: true,
      cause: options?.cause,
    });
  }
}

export class AIQuotaExceededError extends AIError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, {
      code: "ai_quota_exceeded",
      retryable: false,
      cause: options?.cause,
    });
  }
}

export class AIBudgetExceededError extends AIError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, {
      code: "ai_budget_exceeded",
      retryable: false,
      cause: options?.cause,
    });
  }
}

export class AITimeoutError extends AIError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, {
      code: "ai_timeout",
      retryable: true,
      cause: options?.cause,
    });
  }
}

export class AIProviderUnavailableError extends AIError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, {
      code: "ai_provider_unavailable",
      retryable: true,
      cause: options?.cause,
    });
  }
}

export class AIConfigurationError extends AIError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, {
      code: "ai_configuration",
      retryable: false,
      cause: options?.cause,
    });
  }
}

export class AIExecutionError extends AIError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, {
      code: "ai_execution",
      retryable: false,
      cause: options?.cause,
    });
  }
}

export class AIRateLimitExceededError extends AIError {
  readonly retryAfterSeconds: number | undefined;

  constructor(
    message: string,
    options?: { cause?: unknown; retryAfterSeconds?: number },
  ) {
    super(message, {
      code: "ai_rate_limit_exceeded",
      retryable: false,
      cause: options?.cause,
    });
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}
