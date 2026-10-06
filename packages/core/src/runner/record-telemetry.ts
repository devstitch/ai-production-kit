export type TelemetryAttributes = Record<string, string | number | boolean>;

export type TelemetryEvent = {
  type: "run" | "provider_failure";
  feature: string;
  runId: string;
  provider?: string;
  errorName?: string;
  fallbackUsed?: boolean;
  attributes?: TelemetryAttributes;
};

export type TelemetryRecorder = {
  record(event: TelemetryEvent): void;
};

export function recordTelemetry(
  telemetry: TelemetryRecorder | undefined,
  event: TelemetryEvent,
): void {
  telemetry?.record(event);
}

export function applyRedaction(
  attributes: TelemetryAttributes,
  keys: readonly string[] | undefined,
  hook?: (attributes: TelemetryAttributes) => TelemetryAttributes,
): TelemetryAttributes {
  const copy = { ...attributes };
  for (const key of keys ?? []) {
    delete copy[key];
  }
  return hook === undefined ? copy : hook(copy);
}
