# Contributing

## Setup

Use Node.js 22 or newer and pnpm 10.17.1.

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

`pnpm test` does not call OpenAI or Anthropic. Live adapter checks are `pnpm --filter @devstitch/providers test:live` and require API keys.

## Changes

Open a pull request against the default branch. Describe the behavior change and the commands you ran. Do not commit `.env` files or API keys.

Package code stays inside the prompt that owns it. `@devstitch/core` may depend on the other workspace packages. Those packages do not import `@devstitch/core`.

## Reporting issues

Use the bug or feature issue template. Include the feature name, the error code, and whether a provider was called.
