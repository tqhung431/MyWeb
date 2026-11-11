// The visitor's time zone, e.g. "Asia/Ho_Chi_Minh". Sent to the API so "today",
// streaks and the early-bird / night-owl badges use your clock, not the server's.
export function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}
