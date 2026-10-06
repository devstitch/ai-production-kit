import {
  inWindow,
  matchesFilter,
  summarizeRuns,
  totalsFor,
  type RunFilter,
  type StoredRun,
  type UsageStore,
  type UsageSummary,
  type UsageTotals,
  type UsageWindow,
} from "./types.js";

export class MemoryUsageStore implements UsageStore {
  readonly #runs: StoredRun[] = [];

  async record(run: StoredRun): Promise<void> {
    this.#runs.push(run);
  }

  async getUserUsage(
    userId: string,
    organizationId: string,
    window: UsageWindow,
  ): Promise<UsageTotals> {
    return totalsFor(
      this.#runs.filter(
        (run) =>
          run.userId === userId &&
          run.organizationId === organizationId &&
          inWindow(run, window),
      ),
    );
  }

  async getOrganizationUsage(organizationId: string, window: UsageWindow): Promise<UsageTotals> {
    return totalsFor(
      this.#runs.filter(
        (run) => run.organizationId === organizationId && inWindow(run, window),
      ),
    );
  }

  async getFeatureUsage(
    feature: string,
    organizationId: string,
    window: UsageWindow,
  ): Promise<UsageTotals> {
    return totalsFor(
      this.#runs.filter(
        (run) =>
          run.featureName === feature &&
          run.organizationId === organizationId &&
          inWindow(run, { ...window, feature }),
      ),
    );
  }

  async listRuns(filter: RunFilter = {}): Promise<StoredRun[]> {
    return this.#runs.filter((run) => matchesFilter(run, filter));
  }

  async summarize(filter: RunFilter = {}): Promise<UsageSummary> {
    return summarizeRuns(await this.listRuns(filter));
  }

  async get(id: string): Promise<StoredRun | undefined> {
    return this.#runs.find((run) => run.id === id);
  }
}
