// Nook's own numbers (Stage 8), next to the automatic ones (request counts, durations…).
// Without telemetry switched on these are "no-op": calling them costs nothing.
// In Grafana / Prometheus they appear as e.g. myweb_focus_sessions_total.

import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("myweb");

export const focusSessionsSaved = meter.createCounter("myweb.focus_sessions", { description: "Focus sessions saved" });
export const songPlays = meter.createCounter("myweb.song_plays", { description: "Song plays counted for the charts" });
export const songUploads = meter.createCounter("myweb.song_uploads", { description: "Songs added" });
export const cacheLookups = meter.createCounter("myweb.cache_lookups", { description: "Valkey cache lookups, by result (hit/miss)" });
export const jobsDone = meter.createCounter("myweb.jobs", { description: "Background jobs, by name and status" });
export const jobDuration = meter.createHistogram("myweb.job.duration", { description: "How long background jobs take", unit: "s" });
export const liveConnections = meter.createUpDownCounter("myweb.realtime.connections", { description: "Open real-time connections" });
