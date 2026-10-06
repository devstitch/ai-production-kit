/**
 * Reference schema for Postgres and Supabase.
 * `prompt_hash` is included so a prompt id and version can be checked against
 * the body that actually ran. Raw prompt and output columns are omitted.
 */
export const AI_RUNS_MIGRATION = `
create table if not exists ai_runs (
  id text primary key,
  feature_name text not null,
  user_id text not null,
  organization_id text not null,
  provider text not null,
  model text not null,
  prompt_id text not null,
  prompt_version text not null,
  prompt_hash text not null,
  status text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  cached_tokens integer,
  estimated_cost double precision not null,
  latency_ms integer not null,
  time_to_first_token_ms integer,
  retry_count integer not null,
  fallback_used boolean not null,
  error_type text,
  trace_id text not null,
  created_at timestamptz not null
);
`.trim();
