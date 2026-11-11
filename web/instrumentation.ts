// OpenTelemetry for the website (Stage 8). Next.js calls register() once when its server starts.
//
// It traces page renders and the API calls Server Components make, and passes the trace on
// (a "traceparent" header) so the API's spans join the SAME trace: one request, every service.
// Off unless OTEL_EXPORTER_OTLP_ENDPOINT is set (docker-compose's "monitoring" profile).

export async function register() {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_SDK_DISABLED === "true") return;
  const { registerOTel } = await import("@vercel/otel");
  const apiUrl = process.env.API_URL ?? "http://127.0.0.1:4000";
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "myweb-web",
    instrumentationConfig: {
      // Only tell OUR API about traces (never third-party sites)
      fetch: { propagateContextUrls: [new RegExp(`^${apiUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)] },
    },
  });
}
