import { createHash } from "node:crypto";
import type { ZodSchema } from "zod";

export type DefinedPrompt<Variables> = {
  id: string;
  version: string;
  variables: ZodSchema<Variables>;
  render: (variables: Variables) => string;
  /** SHA-256 of the render function source. Editing the body changes the hash. */
  hash: string;
};

export function promptHash(render: (variables: never) => string): string {
  return createHash("sha256").update(render.toString()).digest("hex");
}

export class PromptRegistry {
  readonly #prompts = new Map<string, DefinedPrompt<unknown>>();

  register<Variables>(prompt: DefinedPrompt<Variables>): void {
    this.#prompts.set(key(prompt.id, prompt.version), prompt as DefinedPrompt<unknown>);
  }

  get(id: string, version: string): DefinedPrompt<unknown> | undefined {
    return this.#prompts.get(key(id, version));
  }
}

function key(id: string, version: string): string {
  return `${id}@${version}`;
}

export function definePrompt<Variables>(
  definition: {
    id: string;
    version: string;
    variables: ZodSchema<Variables>;
    render: (variables: Variables) => string;
  },
  registry?: PromptRegistry,
): DefinedPrompt<Variables> {
  const prompt: DefinedPrompt<Variables> = {
    id: definition.id,
    version: definition.version,
    variables: definition.variables,
    render: definition.render,
    hash: promptHash(definition.render as (variables: never) => string),
  };
  registry?.register(prompt);
  return prompt;
}
