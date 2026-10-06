export type ResolvedModel = {
  provider: string;
  model: string;
};

export type ModelRegistration = {
  key: string;
  provider: string;
  model: string;
  environment?: string;
};

export class UnregisteredModelKeyError extends Error {
  readonly key: string;

  constructor(key: string) {
    super(`Model "${key}" is not registered.`);
    this.name = "UnregisteredModelKeyError";
    this.key = key;
  }
}

export class ModelRegistry {
  readonly #entries: ModelRegistration[] = [];

  register(entry: ModelRegistration): void {
    this.#entries.push(entry);
  }

  resolve(ref: string, environment: string): ResolvedModel {
    const matches = this.#entries.filter((entry) => entry.key === ref);
    if (matches.length > 0) {
      const specific = matches.find((entry) => entry.environment === environment);
      const fallback = matches.find((entry) => entry.environment === undefined);
      const selected = specific ?? fallback;
      if (selected === undefined) {
        throw new UnregisteredModelKeyError(ref);
      }
      return { provider: selected.provider, model: selected.model };
    }

    const separator = ref.indexOf(":");
    if (separator > 0 && separator < ref.length - 1) {
      return {
        provider: ref.slice(0, separator),
        model: ref.slice(separator + 1),
      };
    }

    throw new UnregisteredModelKeyError(ref);
  }
}
