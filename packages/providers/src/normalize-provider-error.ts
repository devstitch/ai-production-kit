import {
  AIAuthenticationError,
  AIError,
  AIExecutionError,
  AIOutputValidationError,
} from "@devstitch/core";
import {
  APICallError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
} from "ai";

export function normalizeProviderError(error: unknown): never {
  if (error instanceof AIError) {
    throw error;
  }

  if (
    NoObjectGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error)
  ) {
    throw new AIOutputValidationError(
      "The model did not return schema-valid structured output.",
      { cause: error },
    );
  }

  if (
    APICallError.isInstance(error) &&
    (error.statusCode === 401 || error.statusCode === 403)
  ) {
    throw new AIAuthenticationError("The provider rejected the API key.", {
      cause: error,
    });
  }

  throw new AIExecutionError("The provider request failed.", { cause: error });
}
