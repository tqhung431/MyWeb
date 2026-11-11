// OpenTelemetry (Stage 8): traces and metrics, so you can follow ONE request through
// Caddy → website → API → PostgreSQL / Valkey in Grafana, and watch counters over time.
//
// Loaded BEFORE the app, so it can wrap libraries as they load:
//   node --import ./dist/telemetry.js dist/index.js
//
// Off unless OTEL_EXPORTER_OTLP_ENDPOINT is set (docker-compose sets it with the "monitoring" profile).
// Everything else comes from standard OTEL_* environment variables (service name, protocol, …).

import { register } from "node:module";

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT && process.env.OTEL_SDK_DISABLED !== "true") {
  // Our code uses ES modules: this hook lets OpenTelemetry see `import`s too, not only `require`s.
  register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);

  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "nook-api",
    // HTTP, Express, PostgreSQL (pg), Valkey (ioredis), Socket.IO… are traced automatically.
    // Turn off the very chatty low-level ones: they'd bury the useful spans.
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
        "@opentelemetry/instrumentation-net": { enabled: false },
        // Keep route handlers, skip one span per middleware (helmet, cookies, JSON…): less noise
        "@opentelemetry/instrumentation-express": { ignoreLayersType: ["middleware" as never, "request_handler" as never] },
        "@opentelemetry/instrumentation-router": { enabled: false },
      }),
    ],
  });
  sdk.start();
  console.log(`Telemetry on: sending to ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}`);

  // Send what's left before the process exits
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => void sdk.shutdown().finally(() => process.kill(process.pid, signal)));
  }
}

export {};
