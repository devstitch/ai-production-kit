# Model routing

Features name a model with `model.primary` and, when a second provider is allowed, `model.fallback`. Those strings are either a logical key or a direct `provider:model` reference.

## Logical models

Register a key once and point features at the key:

```ts
models.register({
  key: "fast",
  provider: "openai",
  model: "gpt-4.1-mini",
});
```

A feature then uses `model: { primary: "fast" }`. The model id stays in the registry instead of being copied through feature code.

## Primary and fallback

`primary` is resolved first. `fallback` is resolved only after the primary provider fails for a fallback-eligible error. See `docs/reliability.md` for which failures are eligible.

A direct reference skips the registry:

```ts
model: {
  primary: "openai:gpt-4.1-mini",
  fallback: "anthropic:claude-haiku-4-5",
}
```

The text before the first colon is the provider name. The rest is the provider model id.

## Environment overrides

Register the same key more than once with an `environment` value. Resolution uses `context.environment`, then `NODE_ENV`, then `"development"`.

```ts
models.register({
  key: "fast",
  provider: "openai",
  model: "gpt-4.1-mini",
  environment: "development",
});

models.register({
  key: "fast",
  provider: "openai",
  model: "gpt-4.1",
  environment: "production",
});
```

An entry with no `environment` is the default when that environment has no specific entry. A key that is not registered, and is not a `provider:model` string, fails the run with `AIConfigurationError` before a provider is called.
