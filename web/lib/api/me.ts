// You (Stage 11): just a name, on this browser. The API answers with Set-Cookie; the browser keeps
// the httpOnly cookie itself, and our JavaScript never touches the token.

import { apiFetch } from "./client";
import { clientId } from "./clientId";
import { timeZone } from "./timezone";

export type Preferences = { timer?: { focus: number; short: number; long: number } };
export type User = { id: string; name: string; createdAt: string; preferences?: Preferences };
export type Me = { user: User | null };
export type MyData = {
  name: string;
  createdAt: string;
  lastSeenAt: string;
  keptForDays: number;
  chatKeptForDays: number;
  counts: Record<"focusSessions" | "badges" | "gameScores" | "songsAdded" | "songLikes" | "posts" | "comments" | "chatMessages" | "watchList", number>;
};

// X-Client-Id lets the API make what this browser did as a guest yours.
const withClient = () => ({ "X-Client-Id": clientId(), "X-Time-Zone": timeZone() });

export async function pickName(name: string): Promise<User> {
  const res = await apiFetch<{ user: User }>("/api/me", { method: "POST", headers: withClient(), body: JSON.stringify({ name }) });
  return res.user;
}

export async function renameMe(name: string): Promise<User> {
  const res = await apiFetch<{ user: User }>("/api/me", { method: "PATCH", body: JSON.stringify({ name }) });
  return res.user;
}

export function deleteMe(): Promise<void> {
  return apiFetch<void>("/api/me", { method: "DELETE" });
}

export function getMyData(): Promise<MyData> {
  return apiFetch<MyData>("/api/me/data");
}

// Save settings to you, so they're kept with your name.
export async function savePreferences(preferences: Preferences): Promise<User> {
  const res = await apiFetch<{ user: User }>("/api/me/preferences", { method: "PUT", body: JSON.stringify(preferences) });
  return res.user;
}
