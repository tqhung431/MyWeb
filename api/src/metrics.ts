// Nook's own numbers (Stage 8), next to the automatic ones (request counts, durations…).
// Without telemetry switched on these are "no-op": calling them costs nothing.
// In Grafana / Prometheus they appear as e.g. nook_focus_sessions_total.

import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("nook");

export const focusSessionsSaved = meter.createCounter("nook.focus_sessions", { description: "Focus sessions saved" });
export const songPlays = meter.createCounter("nook.song_plays", { description: "Song plays counted for the charts" });
export const songUploads = meter.createCounter("nook.song_uploads", { description: "Songs added" });
export const cacheLookups = meter.createCounter("nook.cache_lookups", { description: "Valkey cache lookups, by result (hit/miss)" });
export const jobsDone = meter.createCounter("nook.jobs", { description: "Background jobs, by name and status" });
export const jobDuration = meter.createHistogram("nook.job.duration", { description: "How long background jobs take", unit: "s" });
export const liveConnections = meter.createUpDownCounter("nook.realtime.connections", { description: "Open real-time connections" });
export const arcadeScores = meter.createCounter("nook.arcade_scores", { description: "Mini Arcade games finished, by game" });
