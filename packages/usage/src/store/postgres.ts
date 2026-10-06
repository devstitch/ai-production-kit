import { AI_RUNS_MIGRATION } from "./schema.js";
import type {
  RunFilter,
  StoredRun,
  UsageStore,
  UsageSummary,
  UsageTotals,
  UsageWindow,
} from "./types.js";

export type SqlClient = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
};

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value !== "") return Number(value);
  return 0;
}

function totalsFrom(row: Record<string, unknown> | undefined): UsageTotals {
  return {
    requests: numberValue(row?.requests),
    inputTokens: numberValue(row?.input_tokens),
    outputTokens: numberValue(row?.output_tokens),
    totalTokens: numberValue(row?.input_tokens) + numberValue(row?.output_tokens),
    estimatedCost: numberValue(row?.estimated_cost),
  };
}

function mapRun(row: Record<string, unknown>): StoredRun {
  const cached = row.cached_tokens;
  const firstToken = row.time_to_first_token_ms;
  const errorType = row.error_type;
  return {
    id: String(row.id),
    featureName: String(row.feature_name),
    userId: String(row.user_id),
    organizationId: String(row.organization_id),
    provider: String(row.provider),
    model: String(row.model),
    promptId: String(row.prompt_id),
    promptVersion: String(row.prompt_version),
    promptHash: String(row.prompt_hash),
    status: row.status === "failure" ? "failure" : "success",
    inputTokens: numberValue(row.input_tokens),
    outputTokens: numberValue(row.output_tokens),
    ...(cached === null || cached === undefined ? {} : { cachedTokens: numberValue(cached) }),
    estimatedCost: numberValue(row.estimated_cost),
    latencyMs: numberValue(row.latency_ms),
    ...(firstToken === null || firstToken === undefined
      ? {}
      : { timeToFirstTokenMs: numberValue(firstToken) }),
    retryCount: numberValue(row.retry_count),
    fallbackUsed: row.fallback_used === true || row.fallback_used === "t" || row.fallback_used === "true",
    ...(errorType === null || errorType === undefined ? {} : { errorType: String(errorType) }),
    traceId: String(row.trace_id),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
  };
}

export class PostgresUsageStore implements UsageStore {
  readonly #client: SqlClient;

  constructor(client: SqlClient) {
    this.#client = client;
  }

  async migrate(): Promise<void> {
    await this.#client.query(AI_RUNS_MIGRATION);
  }

  async record(run: StoredRun): Promise<void> {
    await this.#client.query(
      `insert into ai_runs (
        id, feature_name, user_id, organization_id, provider, model, prompt_id,
        prompt_version, prompt_hash, status, input_tokens, output_tokens, cached_tokens,
        estimated_cost, latency_ms, time_to_first_token_ms, retry_count, fallback_used,
        error_type, trace_id, created_at
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
      )`,
      [
        run.id,
        run.featureName,
        run.userId,
        run.organizationId,
        run.provider,
        run.model,
        run.promptId,
        run.promptVersion,
        run.promptHash,
        run.status,
        run.inputTokens,
        run.outputTokens,
        run.cachedTokens ?? null,
        run.estimatedCost,
        run.latencyMs,
        run.timeToFirstTokenMs ?? null,
        run.retryCount,
        run.fallbackUsed,
        run.errorType ?? null,
        run.traceId,
        run.createdAt,
      ],
    );
  }

  async getUserUsage(
    userId: string,
    organizationId: string,
    window: UsageWindow,
  ): Promise<UsageTotals> {
    return this.#aggregate(
      `user_id = $1 and organization_id = $2 and created_at >= $3 and created_at <= $4`,
      [userId, organizationId, window.start, window.end],
      window.feature,
    );
  }

  async getOrganizationUsage(organizationId: string, window: UsageWindow): Promise<UsageTotals> {
    return this.#aggregate(
      `organization_id = $1 and created_at >= $2 and created_at <= $3`,
      [organizationId, window.start, window.end],
      window.feature,
    );
  }

  async getFeatureUsage(
    feature: string,
    organizationId: string,
    window: UsageWindow,
  ): Promise<UsageTotals> {
    const result = await this.#client.query(
      `select count(*) as requests,
              coalesce(sum(input_tokens), 0) as input_tokens,
              coalesce(sum(output_tokens), 0) as output_tokens,
              coalesce(sum(estimated_cost), 0) as estimated_cost
       from ai_runs
       where feature_name = $1 and organization_id = $2
         and created_at >= $3 and created_at <= $4`,
      [feature, organizationId, window.start, window.end],
    );
    return totalsFrom(result.rows[0]);
  }

  async listRuns(filter: RunFilter = {}): Promise<StoredRun[]> {
    const { clause, values } = filterClause(filter);
    const result = await this.#client.query(
      `select * from ai_runs ${clause} order by created_at asc`,
      values,
    );
    return result.rows.map((row) => mapRun(row));
  }

  async summarize(filter: RunFilter = {}): Promise<UsageSummary> {
    const { clause, values } = filterClause(filter);
    const result = await this.#client.query(
      `select count(*) as runs,
              coalesce(sum(input_tokens + output_tokens), 0) as tokens,
              coalesce(sum(estimated_cost), 0) as estimated_cost,
              coalesce(avg(latency_ms), 0) as average_latency_ms,
              coalesce(sum(case when status = 'success' then 1 else 0 end), 0) as successes,
              coalesce(sum(case when fallback_used then 1 else 0 end), 0) as fallback_count
       from ai_runs ${clause}`,
      values,
    );
    const row = result.rows[0];
    const runs = numberValue(row?.runs);
    return {
      runs,
      tokens: numberValue(row?.tokens),
      estimatedCost: numberValue(row?.estimated_cost),
      successRate: runs === 0 ? 0 : numberValue(row?.successes) / runs,
      averageLatencyMs: numberValue(row?.average_latency_ms),
      fallbackCount: numberValue(row?.fallback_count),
    };
  }

  async #aggregate(
    where: string,
    values: readonly unknown[],
    feature: string | undefined,
  ): Promise<UsageTotals> {
    const featureClause = feature === undefined ? "" : ` and feature_name = $${values.length + 1}`;
    const result = await this.#client.query(
      `select count(*) as requests,
              coalesce(sum(input_tokens), 0) as input_tokens,
              coalesce(sum(output_tokens), 0) as output_tokens,
              coalesce(sum(estimated_cost), 0) as estimated_cost
       from ai_runs
       where ${where}${featureClause}`,
      feature === undefined ? values : [...values, feature],
    );
    return totalsFrom(result.rows[0]);
  }
}

function filterClause(filter: RunFilter): { clause: string; values: unknown[] } {
  const parts: string[] = [];
  const values: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    values.push(value);
    parts.push(sql.replace("?", `$${values.length}`));
  };
  if (filter.feature !== undefined) add("feature_name = ?", filter.feature);
  if (filter.provider !== undefined) add("provider = ?", filter.provider);
  if (filter.model !== undefined) add("model = ?", filter.model);
  if (filter.organizationId !== undefined) add("organization_id = ?", filter.organizationId);
  if (filter.userId !== undefined) add("user_id = ?", filter.userId);
  if (filter.promptVersion !== undefined) add("prompt_version = ?", filter.promptVersion);
  if (filter.since !== undefined) add("created_at >= ?", filter.since);
  if (filter.until !== undefined) add("created_at <= ?", filter.until);
  return {
    clause: parts.length === 0 ? "" : `where ${parts.join(" and ")}`,
    values,
  };
}
