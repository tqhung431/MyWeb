// You (Stage 11): just a name, on this browser. The API answers with Set-Cookie; the browser keeps
// the httpOnly cookie itself, and our JavaScript never touches the token.

import { apiFetch } from "./client";
import { clientId } from "./clientId";
import { timeZone } from "./timezone";

export type Preferences = { timer?: { focus: number; short: number; long: number } };
// Stage 27: hasPin = the name is protected (it can be signed into on another device); pausedUntil = paused by the admin
export type User = { id: string; name: string; createdAt: string; preferences?: Preferences; hasPin?: boolean; pausedUntil?: string | null };
export type Device = { id: string; userAgent: string; createdAt: string; lastUsedAt: string; current: boolean };
export type Me = { user: User | null };
export type MyData = {
  name: string;
  createdAt: string;
  lastSeenAt: string;
  keptForDays: number;
  chatKeptForDays: number;
  counts: Record<
    | "focusSessions"
    | "badges"
    | "gameScores"
    | "songsAdded"
    | "songLikes"
    | "posts"
    | "comments"
    | "chatMessages"
    | "privateMessages"
    | "chatPictures"
    | "watchList"
    | "habits"
    | "books"
    | "quizGames",
    number
  >;
};

// X-Client-Id lets the API make what this browser did as a guest yours.
const withClient = () => ({ "X-Client-Id": clientId(), "X-Time-Zone": timeZone() });

export async function pickName(name: string, pin?: string): Promise<User> {
  const res = await apiFetch<{ user: User }>("/api/me", { method: "POST", headers: withClient(), body: JSON.stringify(pin ? { name, pin } : { name }) });
  return res.user;
}

// --- Stage 27: PIN, signing in on another device, devices ---
export async function signIn(name: string, pin: string): Promise<User> {
  return (await apiFetch<{ user: User }>("/api/me/sign-in", { method: "POST", body: JSON.stringify({ name, pin }) })).user;
}
export async function signInWithCode(code: string): Promise<User> {
  return (await apiFetch<{ user: User }>("/api/me/sign-in/code", { method: "POST", body: JSON.stringify({ code }) })).user;
}
export async function setPin(pin: string): Promise<User> {
  return (await apiFetch<{ user: User }>("/api/me/pin", { method: "PUT", body: JSON.stringify({ pin }) })).user;
}
export const makeDeviceCode = () => apiFetch<{ code: string; expiresAt: string }>("/api/me/codes", { method: "POST" });
export const signOut = () => apiFetch<void>("/api/me/sign-out", { method: "POST" });
export const getDevices = () => apiFetch<Device[]>("/api/me/devices");
export const signOutDevice = (id: string) => apiFetch<{ signedOut: number }>(`/api/me/devices/${id}`, { method: "DELETE" });

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
