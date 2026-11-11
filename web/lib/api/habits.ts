// Habit & Reading Tracker (Stage 13). "Today" is your browser's time zone, sent as X-Time-Zone.

import { sendOrKeep } from "../offline";
import { apiFetch } from "./client";
import { timeZone } from "./timezone";

export type Color = "violet" | "rose" | "amber" | "emerald" | "sky" | "fuchsia";
export type Habit = {
  id: number;
  name: string;
  emoji: string;
  color: Color;
  perWeek: number;
  reminderTime: string | null;
  doneToday: boolean;
  days: string[];
  streak: { count: number; unit: "day" | "week" };
  thisWeek: number;
};
export type HabitInput = { name: string; emoji: string; color: Color; perWeek: number; reminderTime: string | null };
export type BookStatus = "want" | "reading" | "finished";
export type Book = {
  id: number;
  title: string;
  author: string;
  totalPages: number | null;
  currentPage: number;
  status: BookStatus;
  startedOn: string | null;
  finishedOn: string | null;
  updatedAt: string;
};
export type ReadingStats = { today: string; series: { day: string; pages: number }[]; week: number; month: number; year: number; finishedThisYear: number };

const tz = () => ({ "X-Time-Zone": timeZone() });

export const getHabits = (weeks = 12) => apiFetch<{ today: string; habits: Habit[] }>(`/api/habits?weeks=${weeks}`, { headers: tz() });
export const createHabit = (h: HabitInput) => apiFetch<Habit>("/api/habits", { method: "POST", headers: tz(), body: JSON.stringify(h) });
export const updateHabit = (id: number, h: Partial<HabitInput>) =>
  apiFetch<Habit>(`/api/habits/${id}`, { method: "PATCH", headers: tz(), body: JSON.stringify(h) });
export const deleteHabit = (id: number) => apiFetch<void>(`/api/habits/${id}`, { method: "DELETE" });
// Works offline: kept on this device and sent later
export const setHabitDay = (id: number, day: string, done: boolean) =>
  sendOrKeep<{ streak: Habit["streak"]; thisWeek: number }>(`habit:${id}:${day}`, `/api/habits/${id}/days/${day}`, {
    method: "PUT",
    headers: tz(),
    body: { done },
  });

export const getBooks = () => apiFetch<Book[]>("/api/books");
export const createBook = (b: { title: string; author: string; totalPages: number | null; status: BookStatus }) =>
  apiFetch<Book>("/api/books", { method: "POST", headers: tz(), body: JSON.stringify(b) });
export const updateBook = (id: number, b: Partial<Pick<Book, "title" | "author" | "totalPages" | "status" | "currentPage">>) =>
  apiFetch<Book>(`/api/books/${id}`, { method: "PATCH", headers: tz(), body: JSON.stringify(b) });
export const deleteBook = (id: number) => apiFetch<void>(`/api/books/${id}`, { method: "DELETE" });
export const logPages = (id: number, pages: number, day: string) =>
  sendOrKeep<Book>(`pages:${id}:${day}:${Date.now()}`, `/api/books/${id}/pages`, { method: "POST", headers: tz(), body: { pages, day } });
export const getReadingStats = (days = 30) => apiFetch<ReadingStats>(`/api/books/stats?days=${days}`, { headers: tz() });

// The same "today" the API uses, computed here too so ticking works offline
export function todayHere(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone() }).format(new Date());
}
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
