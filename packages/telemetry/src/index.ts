export type TelemetryAttributes = Record<string, string | number | boolean>;

export type SpanEvent = {
  type: string;
  feature: string;
  runId: string;
  provider?: string;
  errorName?: string;
  fallbackUsed?: boolean;
  attributes?: TelemetryAttributes;
};

export type TelemetrySink = {
  record(event: SpanEvent): void;
};

/**
 * Dev exporter. Prints one JSON span per event.
 * When `otlpEndpoint` or OTEL_EXPORTER_OTLP_ENDPOINT is set, the same span is
 * also posted as OTLP HTTP JSON. Local development does not need that variable.
 */
export function createTelemetry(options?: {
  write?: (line: string) => void;
  otlpEndpoint?: string;
  fetch?: typeof fetch;
}): TelemetrySink & { readonly spans: SpanEvent[] } {
  const spans: SpanEvent[] = [];
  const write = options?.write ?? ((line: string) => console.info(line));
  const requested = options?.otlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const endpoint = requested === undefined || requested === "" ? undefined : requested;

  return {
    spans,
    record(event: SpanEvent) {
      spans.push(event);
      write(JSON.stringify({ span: event.type, attributes: event.attributes ?? {} }));
      if (endpoint !== undefined) {
        const body = otlpPayload(event);
        const send = options?.fetch ?? fetch;
        void send(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }).catch(() => undefined);
      }
    },
  };
}

export function otlpPayload(event: SpanEvent) {
  const attributes = Object.entries(event.attributes ?? {}).map(([key, value]) => ({
    key,
    value:
      typeof value === "number"
        ? { doubleValue: value }
        : typeof value === "boolean"
          ? { boolValue: value }
          : { stringValue: value },
  }));
  return {
    resourceSpans: [
      {
        scopeSpans: [
          {
            scope: { name: "@devstitch/telemetry" },
            spans: [
              {
                name: event.type,
                attributes,
              },
            ],
          },
        ],
      },
    ],
  };
}
