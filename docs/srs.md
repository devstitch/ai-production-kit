DevStitch AI Production Kit
Product Requirements Document / Internal Build Specification
Project Type: Open-source production AI reference architecture + reusable TypeScript packages
Repository: devstitch/ai-production-kit
License: MIT
Status: V1 Planning
Primary Audience: Bootstrapped and pre-seed SaaS founders / engineering teams
 1. Product Summary
DevStitch AI Production Kit is an open-source TypeScript toolkit and reference architecture for taking an AI feature from a basic model API call to a production-ready SaaS capability.
The project should answer the practical question:
“I already know how to call OpenAI or Anthropic. What do I need around that call before I can safely put this AI feature in front of real customers?”
The kit should provide reusable patterns and components for:
  AI feature definition;
  structured outputs;
  streaming;
  prompt versioning;
  model routing;
  retries;
  timeouts;
  provider fallback;
  usage tracking;
  cost tracking;
  user and tenant quotas;
  budget controls;
  rate limits;
  observability;
  privacy-aware logging;
  evaluations;
  consistent error handling.
The project should demonstrate the difference between:
Prototype AI Feature

User
 ↓
OpenAI API
 ↓
Response


and:
Production AI Feature

User
 ↓
Feature Policy
 ↓
Quota / Budget Check
 ↓
Prompt Version
 ↓
Model Routing
 ↓
Timeout / Retry / Fallback
 ↓
OpenAI / Anthropic
 ↓
Output Validation
 ↓
Usage + Cost Accounting
 ↓
Observability
 ↓
Application


The second architecture is the product.
 2. Product Positioning
Recommended GitHub Headline
Production infrastructure for AI features in SaaS applications.
Add structured outputs, retries, fallbacks, quotas, cost controls, prompt versions and observability around your OpenAI and Anthropic features without building the production layer from scratch.
 3. What This Project Is
The AI Production Kit is:
  a reusable production layer around AI features;
  a reference architecture for SaaS engineering teams;
  a set of composable TypeScript packages;
  a realistic production example;
  provider-aware but not tightly provider-locked;
  suitable for multi-user and multi-tenant SaaS applications.
It should help developers move from:
const response = await openai.responses.create(...)


to something conceptually closer to:
const result = await ai.run("support-ticket-triage", {
  input,
  userId,
  organizationId
})


where the runtime automatically applies the production policies defined for that feature.
 4. What This Project Is NOT
V1 should NOT become:
  another chatbot starter;
  another generic SaaS boilerplate;
  a replacement for OpenAI's SDK;
  a replacement for Anthropic's SDK;
  a new universal LLM provider standard;
  an agent framework;
  an MCP framework;
  a RAG framework;
  a vector database abstraction;
  a prompt-management SaaS;
  an observability SaaS;
  an evaluation SaaS;
  an autonomous workflow engine.
We should integrate proven primitives rather than rebuilding them.
The current AI SDK ecosystem already provides provider abstraction, structured generation, streaming and broad model support. The DevStitch layer should therefore differentiate on production controls rather than recreating those primitives.
 5. Primary Goals
The project should demonstrate how to:
 Define an AI capability as an explicit application feature.
 Attach production policies to that feature.
 Use OpenAI and Anthropic behind a consistent application interface.
 Validate inputs before sending them to a model.
 Validate structured model outputs before application use.
 Stream user-facing text safely.
 Apply request timeouts.
 Retry transient failures intelligently.
 Fall back to another configured provider/model.
 Track model usage.
 Estimate cost per invocation.
 enforce user and tenant quotas.
 enforce feature-level budgets.
 rate-limit AI functionality.
 version prompts.
 identify which prompt version produced a result.
 trace AI calls through OpenTelemetry.
 avoid storing sensitive prompt/output data by default.
 run repeatable evaluations before changing prompts or models.
 provide consistent errors back to the host application.
 6. Target Audience
Primary — B1 Bootstrapped SaaS Founders
Founders who have:
  added an AI feature quickly;
  built with Cursor, Claude Code, Replit, Lovable or similar tools;
  connected directly to an LLM API;
  reached the point where real users, costs and reliability matter.
Typical situation:
“The AI feature works, but now I need to control cost, handle failures and make sure changes don't break production.”
 Secondary — B2 Pre-Seed SaaS Startups
Startups that already have engineering capability but need a repeatable architecture for production AI functionality.
Typical concerns:
  multiple AI features;
  growing usage;
  customer-level quotas;
  cost visibility;
  model changes;
  provider resilience;
  production monitoring;
  prompt regressions;
  model/provider experimentation.
 Technical Users
  Full-stack developers
  AI engineers
  Technical founders
  SaaS engineering teams
  Product engineers
 7. Architectural Principle
The central abstraction should be an:
AI Feature
An AI Feature represents a specific product capability rather than a raw model invocation.
Examples:
support-ticket-triage

generate-support-reply

summarize-project

extract-invoice

classify-feedback


An AI Feature should own or reference:
Input Schema
Prompt
Prompt Version
Output Schema
Model Policy
Timeout
Retry Policy
Fallback Policy
Rate Limit
Quota
Budget
Telemetry Policy
Privacy Policy


This makes production behavior explicit rather than scattered around application code.
 8. Example Developer Experience
The desired high-level API should look conceptually like:
const ticketTriage = defineFeature({
  name: "support-ticket-triage",

  input: TicketInputSchema,

  output: TicketTriageSchema,

  prompt: {
    id: "support-ticket-triage",
    version: "1.2.0"
  },

  model: {
    primary: "openai:gpt-model",
    fallback: "anthropic:claude-model"
  },

  timeout: 15_000,

  retries: 2,

  quota: {
    perUser: "100/day",
    perOrganization: "5000/month"
  },

  budget: {
    maxCostPerRun: 0.10
  }
})


Application code:
const result = await ai.run(ticketTriage, {
  input: {
    subject,
    message
  },

  context: {
    userId,
    organizationId
  }
})


Returned result:
{
  data,
  meta: {
    runId,
    feature,
    provider,
    model,
    promptVersion,
    inputTokens,
    outputTokens,
    estimatedCost,
    latencyMs,
    attempts,
    fallbackUsed
  }
}


The final exact API can be adjusted during technical design.
The principle is more important than this syntax.
 9. Technical Baseline
Core
  TypeScript
  Node.js
  pnpm
  Turborepo
  Zod
AI Runtime
Use an established provider/model abstraction underneath the DevStitch runtime rather than building provider compatibility from scratch.
Recommended baseline:
  AI SDK core;
  OpenAI provider;
  Anthropic provider.
The AI SDK already supports a standardized provider architecture across OpenAI, Anthropic and many other providers.
DevStitch should place a thin boundary around this dependency so the core architecture is not unnecessarily tied to one underlying library.
 10. Initial Provider Support
V1 officially demonstrates:
OpenAI
and
Anthropic
The architecture should allow additional providers later.
Possible V2 providers:
  Google Gemini
  Amazon Bedrock
  Azure OpenAI
  OpenRouter
  Groq
  other AI SDK-compatible providers
Do not implement many providers in V1.
Two mature providers are enough to demonstrate routing and fallback.
 11. Proposed Repository Structure
ai-production-kit/
│
├── packages/
│   │
│   ├── core/
│   │   ├── feature/
│   │   ├── runner/
│   │   ├── errors/
│   │   └── types/
│   │
│   ├── model-router/
│   │
│   ├── prompts/
│   │
│   ├── reliability/
│   │   ├── retries/
│   │   ├── timeout/
│   │   └── fallback/
│   │
│   ├── usage/
│   │   ├── tokens/
│   │   ├── pricing/
│   │   ├── quota/
│   │   └── budget/
│   │
│   ├── telemetry/
│   │
│   ├── policies/
│   │
│   ├── evals/
│   │
│   └── shared/
│
├── apps/
│   └── demo/
│
├── examples/
│   ├── structured-output/
│   ├── streaming/
│   ├── fallback/
│   ├── quotas/
│   └── evaluations/
│
├── docs/
│   ├── architecture.md
│   ├── defining-features.md
│   ├── model-routing.md
│   ├── reliability.md
│   ├── usage-costs.md
│   ├── prompt-versioning.md
│   ├── observability.md
│   ├── privacy.md
│   ├── evaluations.md
│   └── production-checklist.md
│
├── .env.example
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENSE
└── README.md


Technical lead may simplify package boundaries where appropriate.
Avoid unnecessary micro-packaging.
 12. Core Execution Pipeline
Every AI Feature invocation should conceptually pass through:
Application
     │
     ▼
Input Validation
     │
     ▼
Identity / Context
     │
     ▼
Rate Limit
     │
     ▼
Quota Check
     │
     ▼
Budget Check
     │
     ▼
Prompt Resolution
     │
     ▼
Model Routing
     │
     ▼
Timeout
     │
     ▼
Provider Request
     │
     ├── Retry if transient
     │
     └── Fallback if required
     │
     ▼
Output Validation
     │
     ▼
Usage Accounting
     │
     ▼
Telemetry
     │
     ▼
Application Result


This pipeline is the architectural heart of the project.
 13. Feature Definition
Developers should define individual AI capabilities separately.
Concept:
defineFeature({
  name,
  description,

  input,
  output,

  prompt,

  model,

  timeout,

  retries,

  quota,

  budget,

  telemetry,

  privacy
})


Feature definitions should be:
  typed;
  explicit;
  testable;
  versionable;
  independent of UI;
  independent of HTTP routes.
 14. Input Validation
All feature inputs must have explicit schemas.
Example:
const TicketInputSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(10_000)
})


Validation should occur before:
  token consumption;
  quota deduction;
  provider execution.
Invalid application input should never unnecessarily reach an LLM.
 15. Structured Outputs
Structured outputs are a primary V1 feature.
Example output:
const TicketTriageSchema = z.object({
  category: z.enum([
    "billing",
    "technical",
    "account",
    "other"
  ]),

  priority: z.enum([
    "low",
    "medium",
    "high",
    "urgent"
  ]),

  summary: z.string(),

  requiresHuman: z.boolean()
})


Application code should receive validated objects rather than parse arbitrary model text.
If structured output validation fails, the runtime should classify the error distinctly.
Do not silently return malformed model output.
 16. Streaming
The kit should support streaming for user-facing generative experiences.
Typical use cases:
  draft generation;
  summaries;
  writing assistance;
  conversational responses.
The streaming API should still produce final metadata after completion:
Provider
Model
Tokens
Cost
Latency
Prompt Version
Finish Reason
Trace ID


Where technically possible, record:
  total latency;
  time to first token/chunk;
  completion time.
 17. Prompt Management
V1 should provide lightweight code-first prompt versioning.
Do NOT build a hosted prompt CMS.
Suggested structure:
prompts/
└── support-ticket-triage/
    ├── 1.0.0.ts
    ├── 1.1.0.ts
    └── 1.2.0.ts


or an equivalent registry.
Each production run should record:
prompt_id
prompt_version
prompt_hash


This allows developers to answer:
“Which prompt generated this production output?”
 18. Prompt Templates
Templates should have explicit variables.
Example:
definePrompt({
  id: "ticket-triage",

  version: "1.2.0",

  variables: z.object({
    subject: z.string(),
    message: z.string()
  }),

  render({ subject, message }) {
    ...
  }
})


Missing or invalid template variables should fail before model execution.
 19. Model Registry
Application features should reference logical model configuration rather than scattering provider model IDs throughout application code.
Example:
models: {
  fast: {
    provider: "openai",
    model: "..."
  },

  balanced: {
    provider: "anthropic",
    model: "..."
  }
}


or:
model: "fast"


Model IDs should remain configurable.
Do not hardcode rapidly changing model names deep inside business logic.
 20. Model Routing
V1 routing should stay understandable.
Support:
Fixed Routing
Feature A → Model A


Primary + Fallback
Feature A
   │
   ▼
OpenAI Primary
   │
 failure
   ▼
Anthropic Fallback


Environment Override
Example:
Development → cheaper model

Production → configured production model


Do NOT build sophisticated ML-based dynamic routing in V1.
 21. Retry Policy
Retries should only occur for failures likely to succeed on another attempt.
Examples:
  transient connection failure;
  selected provider 5xx errors;
  eligible rate-limit conditions;
  temporary upstream failure.
Do NOT blindly retry:
  authentication failure;
  malformed request;
  invalid application schema;
  clearly permanent configuration error.
Support:
retry: {
  attempts: 2,
  backoff: "exponential",
  maxDelayMs: 2000
}


Retry count must be recorded in run metadata.
 22. Timeout Policy
Every production AI request should have an explicit timeout.
Example:
timeout: 15_000


Timeout should:
 cancel the underlying provider request where supported;
 produce a classified timeout error;
 participate in fallback policy where configured;
 appear in telemetry.
No AI request should run indefinitely because the application forgot to set a timeout.
 23. Provider Fallback
Support simple primary/fallback configuration.
Example:
Primary:
OpenAI

Fallback:
Anthropic


Fallback should be triggered only for configured conditions such as:
  provider unavailable;
  timeout;
  selected server errors;
  configured rate-limit failures.
Fallback should NOT automatically hide all application errors.
Every fallback event should be observable.
Returned metadata:
{
  fallbackUsed: true,
  attempts: [
    {
      provider: "openai",
      status: "timeout"
    },
    {
      provider: "anthropic",
      status: "success"
    }
  ]
}


 24. Error Taxonomy
Create consistent runtime error categories.
At minimum:
AIInputValidationError

AIOutputValidationError

AIAuthenticationError

AIProviderRateLimitError

AIQuotaExceededError

AIBudgetExceededError

AITimeoutError

AIProviderUnavailableError

AIConfigurationError

AIExecutionError


The host application should be able to handle errors programmatically.
Do not expose raw provider/internal errors directly to end users.
 25. Usage Tracking
Each successful or attempted provider execution should capture usage information when available.
Suggested normalized fields:
input_tokens
output_tokens
cached_input_tokens
cache_write_tokens
total_tokens
provider
model
feature
user_id
organization_id
timestamp


The usage schema should be extensible because provider accounting varies.
Do not force every provider into fields that do not apply.
 26. Cost Tracking
The kit should provide estimated AI cost per execution.
Architecture:
Provider Usage
      │
      ▼
Normalized Usage
      │
      ▼
Pricing Catalog
      │
      ▼
Estimated Cost


Pricing must NOT be permanently hardcoded inside feature logic.
Use a configurable pricing registry:
pricing.register({
  provider,
  model,
  effectiveFrom,
  inputTokenRate,
  outputTokenRate
})


Where relevant, support separate rates for:
  normal input;
  cached input;
  cache writes;
  output.
The returned value should clearly be identified as an estimated provider cost.
 27. Usage Ledger
Provide a storage abstraction for recording AI executions.
Example interface:
interface UsageStore {
  record(run): Promise<void>

  getUserUsage(...): Promise<Usage>

  getOrganizationUsage(...): Promise<Usage>
}


Core should remain storage-agnostic.
Provide:
Development
In-memory implementation.
Demo / Reference
PostgreSQL/Supabase implementation.
 28. Quotas
Support quotas at multiple dimensions.
Examples:
Per User
100 AI actions / day


Per Organization
5,000 AI actions / month


Feature Specific
invoice-extraction:
500 / month


Possible quota units:
  request count;
  tokens;
  estimated cost.
V1 does not need every possible combination, but architecture should support these dimensions.
 29. Budget Controls
Budget checks should protect SaaS unit economics.
Examples:
Maximum cost per invocation

Maximum user AI spend per day

Maximum organization AI spend per month

Maximum feature spend per month


Example:
budget: {
  maxEstimatedCostPerRun: 0.10,

  organization: {
    monthly: 500
  }
}


If a pre-run cost cannot be known precisely, the framework may:
 check current accumulated budget;
 apply configured request limits;
 record actual estimated cost afterward.
Document this limitation clearly.
 30. Rate Limiting
Rate limiting is separate from subscription quota.
Rate limits prevent bursts such as:
10 requests / minute / user


while quotas govern longer usage periods such as:
1,000 requests / month


Provide a rate-limit adapter interface.
Possible reference implementations:
  in-memory development adapter;
  Redis-compatible production example.
Do not force Redis as a requirement for local development.
 31. Observability
Observability is a core feature, not optional polish.
Use OpenTelemetry-compatible instrumentation.
OpenTelemetry's GenAI conventions provide standardized attributes and metrics around GenAI operations, including model information, token usage and operation duration.
Every feature run should generate enough telemetry to answer:
What feature ran?
Which provider/model was used?
How long did it take?
How many tokens were consumed?
What did it cost?
Did it retry?
Did fallback occur?
Which prompt version ran?
Did it succeed?
 32. Recommended Trace Metadata
Example:
ai.feature.name
ai.run.id

gen_ai.provider.name
gen_ai.request.model

ai.prompt.id
ai.prompt.version

ai.user.id
ai.organization.id

ai.retry.count
ai.fallback.used

ai.cost.estimated

gen_ai.client.token.usage

gen_ai.client.operation.duration


Where an established OpenTelemetry semantic convention exists, use it rather than inventing a competing field.
 33. Privacy-Aware Telemetry
Raw prompts and responses can contain:
  customer data;
  personal information;
  confidential business content.
Therefore:
Default
Do NOT persist complete raw prompts or outputs in telemetry.
Optional
Allow developers to explicitly enable content recording.
Hooks
Provide redaction/filter hooks before content is persisted.
OpenTelemetry explicitly warns that GenAI prompt and output attributes may contain sensitive or personally identifiable information.
Privacy-first defaults should therefore be a deliberate project principle.
 34. Request Metadata
Applications should be able to pass metadata such as:
context: {
  userId,
  organizationId,
  requestId,
  environment,
  featureFlags
}


This context should be available to:
  quota policies;
  telemetry;
  budget checks;
  audit records.
Metadata should not automatically be sent to the LLM.
 35. Policy Hooks
Provide extension points around execution.
Conceptually:
beforeRun

beforeProviderCall

afterProviderCall

afterRun

onError


Potential uses:
  PII redaction;
  custom authorization;
  content moderation;
  analytics;
  feature flags;
  application-specific governance.
Keep the hook API small.
Do not create a general workflow engine.
 36. Safety / Guardrail Boundary
The kit should support hooks for safety controls but should NOT claim to provide a universal AI safety framework.
Possible integrations:
Pre-input policy

Provider moderation

Post-output policy

Application-specific validators


The important architectural rule:
Model output is untrusted application input.
Structured outputs still require schema validation.
Text outputs should never automatically be used for privileged operations without additional application controls.
 37. Evaluation Framework
Prompt/model changes should be testable before production.
Provide a lightweight evaluation runner.
Example:
eval("ticket-triage", {
  cases: [
    ...
  ]
})


Evaluation case:
{
  input: {
    subject: "...",
    message: "..."
  },

  expected: {
    category: "billing"
  }
}


 38. V1 Evaluation Types
Support deterministic evaluation first.
Examples:
Schema Validation
Did output satisfy the expected structure?
Exact Match
expected category = billing


Contains / Regex
Useful for generated text tests.
Custom Scorer
score(result, expected)


Optional later:
  semantic similarity;
  model-as-judge;
  human review integrations.
Do not build a sophisticated evaluation platform in V1.
 39. Regression Testing
The repo should demonstrate:
Prompt v1
   ↓
Evaluation Dataset
   ↓
Baseline

Prompt v2
   ↓
Same Dataset
   ↓
Compare


A prompt/model change should be able to answer:
Did quality improve?

Did latency change?

Did token use change?

Did estimated cost change?

Did schema failures increase?


This is important production engineering behavior.
 40. Demo Application
The demonstration app should remain small.
Recommended domain:
AI Support Copilot
The application receives customer support tickets.
It demonstrates two AI features.
 41. Demo Feature A — Ticket Triage
Input:
Subject

Customer message


AI returns structured data:
{
  "category": "technical",
  "priority": "high",
  "summary": "...",
  "requiresHuman": true
}


This demonstrates:
  structured outputs;
  input validation;
  prompt versions;
  quotas;
  cost tracking;
  tracing;
  fallback.
 42. Demo Feature B — Draft Response
Generate a suggested support reply.
The response should stream to the UI.
This demonstrates:
  streaming;
  timeout;
  tokens;
  latency;
  cost;
  provider routing.
No autonomous sending of email is required.
The user simply sees a draft.
 43. Demo Run Inspector
Each demo AI execution should expose developer-facing metadata.
Example:
Feature
ticket-triage

Provider
OpenAI

Model
configured-model

Prompt
1.2.0

Latency
1.42s

Input tokens
842

Output tokens
117

Estimated cost
$...

Retries
0

Fallback
No

Trace ID
...


This is an important visual proof of what the production kit provides.
 44. Usage Dashboard
The demo should include a minimal internal dashboard showing:
Runs Today

Tokens

Estimated Cost

Success Rate

Average Latency

Fallback Count


Also allow filtering by:
  feature;
  provider;
  model;
  organization/user where applicable.
This is a reference UI, not a full analytics product.
 45. Prompt Version Display
The demo should make prompt versioning visible.
Example:
Ticket Triage
Prompt v1.2.0


Developers should be able to compare runs generated by different prompt versions.
No visual prompt editor is required.
 46. Fallback Demonstration
Provide an easy development/demo mechanism for intentionally simulating primary-provider failure.
Example:
SIMULATE_PRIMARY_FAILURE=true


or a testing adapter.
Then demonstrate:
Primary provider
      ↓
     FAIL
      ↓
Fallback provider
      ↓
    SUCCESS


Run metadata should clearly show the fallback.
This makes one of the project's strongest production concepts easy to demonstrate.
 47. Storage Schema — Reference Implementation
The demo may use Supabase/PostgreSQL.
Recommended tables:
ai_runs

ai_usage

ai_prompt_versions

ai_quota_usage

ai_eval_runs


 48. AI Run Record
Suggested fields:
id

feature_name

user_id

organization_id

provider

model

prompt_id

prompt_version

status

input_tokens

output_tokens

cached_tokens

estimated_cost

latency_ms

time_to_first_token_ms

retry_count

fallback_used

error_type

trace_id

created_at


Do not persist raw prompts or outputs by default.
 49. Local Developer Experience
Target:
git clone ...
pnpm install


Configure:
OPENAI_API_KEY=

ANTHROPIC_API_KEY=

DATABASE_URL=

OTEL_EXPORTER_OTLP_ENDPOINT=


Then:
pnpm dev


External telemetry infrastructure should NOT be mandatory for basic local development.
Provide a console/dev exporter or equivalent local-friendly configuration.
 50. Simple Integration Experience
README should show a minimal example quickly.
Example concept:
import {
  createAIRuntime,
  defineFeature
} from "@devstitch/ai-production-kit"


Then:
const ai = createAIRuntime({
  models,
  telemetry,
  usageStore
})


Followed by:
await ai.run(feature, {
  input,
  context
})


A developer should understand the project value within the first few minutes.
 51. Testing Requirements
Unit Tests
Cover:
  input validation;
  prompt resolution;
  pricing calculations;
  quota calculation;
  budget checks;
  retry classification;
  fallback decisions;
  error normalization.
 Integration Tests
Cover:
  OpenAI adapter;
  Anthropic adapter;
  structured generation;
  streaming;
  telemetry;
  usage persistence;
  quota rejection;
  fallback behavior.
Provider-dependent live integration tests should be separated from normal CI so contributors are not required to provide paid API keys for basic tests.
 52. Reliability Test Cases
Timeout
Provider exceeds configured timeout.
Expected:
AITimeoutError


or fallback if configured.
 Transient Provider Failure
Primary provider returns eligible transient failure.
Expected:
Retry

then fallback when configured


 Invalid Input
Application sends malformed feature input.
Expected:
Rejected before provider execution


 Invalid Structured Output
Model fails output schema.
Expected:
AIOutputValidationError


according to configured retry policy.
 Quota Exceeded
User has exceeded allowed usage.
Expected:
AIQuotaExceededError

No provider call


 Budget Exceeded
Organization has reached configured spending threshold.
Expected:
AIBudgetExceededError

No provider call


 53. Privacy Tests
Tests should confirm:
Raw Content Off
Prompt/output body does not appear in telemetry by default.
Redaction
Configured sensitive fields are redacted.
Context Isolation
Internal metadata not explicitly included in the prompt is not sent to the provider.
 54. Documentation Requirements
architecture.md
Explain:
Application

Feature

Runtime

Policy

Provider

Telemetry

Storage


 defining-features.md
Show how to define an AI feature from scratch.
 model-routing.md
Explain:
  logical models;
  primary provider;
  fallback provider;
  model overrides.
 reliability.md
Explain:
  timeouts;
  retries;
  fallback;
  error classification.
 usage-costs.md
Explain:
  token normalization;
  price catalog;
  estimated cost;
  quotas;
  budgets.
 prompt-versioning.md
Explain:
  prompt IDs;
  semantic versions;
  hashes;
  regression testing.
 observability.md
Explain OpenTelemetry integration.
 privacy.md
Explain:
  content recording defaults;
  sensitive information;
  redaction;
  provider considerations.
 evaluations.md
Explain how to create and run evaluation datasets.
 production-checklist.md
Provide a concise checklist for shipping an AI feature.
Example:
[ ] Input validation

[ ] Structured output validation

[ ] Timeout configured

[ ] Retry configured

[ ] Fallback decision made

[ ] Quotas configured

[ ] Budget configured

[ ] Usage tracked

[ ] Prompt versioned

[ ] Telemetry enabled

[ ] Sensitive logging reviewed

[ ] Evaluations passing


This checklist can become one of the most useful/shareable parts of the repository.
 55. README Requirements
Above the fold:
AI Production Kit
Production infrastructure for AI features in SaaS applications.
Then:
Your SaaS Feature
       │
       ▼
┌─────────────────────────────┐
│ DevStitch AI Production Kit │
│                             │
│ Validation                  │
│ Prompt Versions             │
│ Model Routing               │
│ Retries / Timeouts          │
│ Fallbacks                   │
│ Quotas / Budgets            │
│ Cost Tracking               │
│ Observability               │
└─────────────┬───────────────┘
              │
       ┌──────┴───────┐
       ▼              ▼
    OpenAI        Anthropic


README sections:
 What problem this solves
 Why model API calls alone are not production architecture
 Features
 Architecture
 Quick start
 Define your first AI Feature
 Structured output example
 Streaming example
 Retry and fallback
 Usage and cost
 Quotas and budgets
 Prompt versioning
 Observability
 Evaluations
 Demo
 Production checklist
 Roadmap
 Contributing
 About DevStitch
 56. DevStitch Positioning
Keep commercial positioning subtle.
Recommended section:
Built by DevStitch
DevStitch is an AI-native product engineering company helping founders build, productionize and scale SaaS products, platforms and mobile applications.
We work across product engineering, production hardening, AI features, integrations and automation.
Then link to DevStitch.
The repository itself should provide the credibility.
Avoid turning the README into a sales page.
 57. Public Repository Quality
Must include:
  MIT License;
  README;
  .env.example;
  CONTRIBUTING.md;
  SECURITY.md;
  issue templates;
  pull request template;
  CI workflow;
  unit tests;
  linting;
  formatting;
  architecture diagrams;
  screenshots;
  example code;
  demo application;
  meaningful commit history;
  changelog/release notes when releases begin.
 58. Security Requirements
Provider API keys must:
  remain server-side;
  never be exposed to browser bundles;
  never be committed.
The project should include:
  secret scanning guidance;
  dependency scanning;
  schema validation;
  safe error handling;
  payload/input limits;
  privacy-first logs.
Provider errors should be normalized before application exposure.
 59. Out of Scope — V1
Do NOT include:
  RAG;
  vector databases;
  MCP;
  autonomous agents;
  tool-running agents;
  browser automation;
  image generation;
  voice;
  realtime voice;
  speech-to-text;
  multimodal pipelines;
  fine-tuning;
  model training;
  custom LLM gateway infrastructure;
  Kubernetes;
  complex queues;
  hosted control plane;
  hosted prompt CMS;
  enterprise SSO;
  full billing system;
  full SaaS starter;
  mobile application.
These can distract from the central production-AI problem.
 60. V1 Feature Scope
V1 should ship with:
Core
  AI Feature abstraction
  feature runner
  input schemas
  structured outputs
  streaming
Providers
  OpenAI
  Anthropic
Reliability
  timeout
  retries
  fallback
Governance
  rate limit hooks
  quotas
  budgets
Usage
  normalized token usage
  configurable pricing
  estimated cost
  usage ledger
Prompts
  prompt registry
  prompt versioning
  prompt hashes
Observability
  OpenTelemetry
  run IDs
  model/provider metadata
  usage
  latency
  retries
  fallback state
Privacy
  raw content disabled by default
  redaction hooks
Quality
  basic evaluation runner
  regression datasets
Reference
  demo application
  documentation
  examples
 61. Suggested Implementation Milestones
Milestone 1 — Core Runtime
Build:
  monorepo;
  package structure;
  feature definition;
  feature registry;
  execution runner;
  Zod input/output validation;
  OpenAI integration;
  Anthropic integration;
  structured generation;
  streaming;
  normalized errors.
Outcome
A developer can define and execute typed AI features through a single runtime.
 62. Milestone 2 — Production Reliability
Build:
  model registry;
  model routing;
  timeout support;
  retry policy;
  transient/permanent error classification;
  provider fallback;
  rate-limit adapter.
Outcome
AI features can withstand common provider failures instead of relying on a single raw API request.
 63. Milestone 3 — Usage & Governance
Build:
  usage normalization;
  pricing registry;
  estimated cost calculation;
  usage-store interface;
  Postgres/Supabase reference store;
  user quotas;
  organization quotas;
  feature quotas;
  budget policies.
Outcome
A SaaS product can understand and control how much AI each customer consumes and costs.
 64. Milestone 4 — Observability & Prompt Lifecycle
Build:
  OpenTelemetry instrumentation;
  traces;
  latency metrics;
  prompt registry;
  prompt versions;
  prompt hashes;
  privacy controls;
  redaction hooks.
Outcome
Developers can trace production AI behavior and identify exactly which configuration generated an output.
 65. Milestone 5 — Evaluations & Demo
Build:
  evaluation runner;
  evaluation cases;
  custom scorers;
  regression comparison;
  Support Copilot demo;
  triage feature;
  streaming draft response;
  run inspector;
  usage dashboard;
  fallback demonstration.
Outcome
The public repository visibly demonstrates the value of the production architecture.
 66. Milestone 6 — OSS Release
Complete:
  documentation;
  README;
  screenshots;
  architecture diagram;
  examples;
  CI;
  security review;
  contribution documentation;
  issue templates;
  production checklist;
  repository cleanup.
Outcome
Public-ready DevStitch open-source project.
 67. Definition of Done
V1 is complete when all of these scenarios work.
Scenario 1
Developer defines an AI Feature with typed input and typed structured output.
 Scenario 2
The application runs the feature against OpenAI successfully.
 Scenario 3
The same architecture can run against Anthropic through configuration rather than rewritten business logic.
 Scenario 4
Invalid application input is rejected before provider invocation.
 Scenario 5
Invalid structured output is detected and not passed silently to the application.
 Scenario 6
A provider call exceeds its timeout.
The runtime terminates it and returns the configured error/fallback behavior.
 Scenario 7
Primary provider experiences an eligible transient failure.
The configured retry policy executes.
 Scenario 8
Primary provider remains unavailable.
Configured fallback provider successfully processes the feature.
 Scenario 9
Run metadata clearly shows the retry and fallback.
 Scenario 10
Token consumption is captured.
 Scenario 11
Estimated provider cost is calculated from the configured pricing registry.
 Scenario 12
A user exceeds their configured quota.
The request is blocked before calling the provider.
 Scenario 13
An organization reaches its configured AI budget.
Further calls are blocked according to policy.
 Scenario 14
An AI call appears in OpenTelemetry with feature, provider, model, latency and usage context.
 Scenario 15
Raw prompts and model outputs do not appear in telemetry under default configuration.
 Scenario 16
A developer changes a prompt version and can identify which production runs used the old versus new prompt.
 Scenario 17
The evaluation runner can execute the same test dataset against two prompt/model configurations.
 Scenario 18
The demo app displays:
  successful run;
  tokens;
  estimated cost;
  latency;
  provider;
  prompt version;
  retries;
  fallback status.
 Scenario 19
A developer unfamiliar with the repository can clone it, configure provider credentials and run the demo using the README.
 68. Primary Demo Story
The final demo should tell this story:
A SaaS founder has an AI support feature.
At prototype stage:
Customer Ticket
      ↓
   OpenAI
      ↓
   Response


It works.
Then real customers arrive.
Now the founder needs to know:
What if OpenAI times out?

What if the provider goes down?

What does every request cost?

Which customer is using the most AI?

How do I stop one customer consuming $500?

Which prompt generated a bad answer?

Will Prompt v2 break cases Prompt v1 handled correctly?

Can I switch models safely?

Am I storing customer prompts in my logs?


With the DevStitch AI Production Kit:
Customer Ticket
      │
      ▼
Feature Definition
      │
      ▼
Validation
      │
      ▼
Quota + Budget
      │
      ▼
Prompt v1.2
      │
      ▼
OpenAI
      │
   timeout?
      │
      ▼
Anthropic Fallback
      │
      ▼
Validated Output
      │
      ├── Tokens
      ├── Cost
      ├── Latency
      ├── Trace
      └── Prompt Version
      │
      ▼
SaaS Product


That transformation should communicate the entire value of the repository.
 69. Product Principles
When making implementation decisions, prioritize:
Reliability > observability > developer experience > provider count > feature count.
Also:
Do not build something simply because an AI framework can support it.
Every feature included in V1 should answer:
“Does this help a SaaS team put an AI capability into production more safely, reliably or economically?”
If the answer is no, leave it out.
 70. Strategic Purpose for DevStitch
This repository is not intended only to collect GitHub stars.
It should become a technical proof asset during founder acquisition.
When a B1 founder says:
“We already have the AI feature working, but we're worried about reliability and API costs.”
DevStitch should be able to show this repository.
When a B2 technical founder says:
“We need to formalize our AI architecture before usage increases.”
DevStitch should be able to show this repository.
The repo should demonstrate that DevStitch understands the difference between:
calling an AI model
and
production.”»engineering an AI-powered product.