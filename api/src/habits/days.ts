// Calendar-day maths for habits and reading (Stage 13). Days are "YYYY-MM-DD" strings in the person's
// time zone, so "today" in Hanoi isn't "today" in London, and no clock change can shift a day.

const DAY_MS = 86_400_000;

// en-CA formats dates as YYYY-MM-DD
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

// "HH:MM" in a time zone, for reminders
export function clockIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

// Monday of the week the day is in
export function weekStart(day: string): string {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -weekday);
}

// Days in a row up to today. Today not done yet doesn't break it: you still have until midnight.
export function dayStreak(done: Set<string>, today: string): number {
  let day = done.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function countInWeek(done: Set<string>, anyDayOfWeek: string): number {
  const start = weekStart(anyDayOfWeek);
  let n = 0;
  for (let i = 0; i < 7; i++) if (done.has(addDays(start, i))) n++;
  return n;
}

// Weeks in a row that met the goal ("3 days a week"). This week counts once it's met; until then it doesn't break the run.
export function weekStreak(done: Set<string>, today: string, perWeek: number): number {
  let week = weekStart(today);
  if (countInWeek(done, week) < perWeek) week = addDays(week, -7);
  let n = 0;
  while (countInWeek(done, week) >= perWeek) {
    n++;
    week = addDays(week, -7);
  }
  return n;
}

export function isDay(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
}
