// Sign-in calls made from the browser. The API answers with Set-Cookie;
// the browser stores the httpOnly cookie itself. Our JavaScript never touches the token.

import { apiFetch } from "./client";
import { clientId } from "./clientId";
import { timeZone } from "./timezone";

export type Preferences = { timer?: { focus: number; short: number; long: number } };
export type User = { id: string; email: string; name: string; createdAt: string; preferences?: Preferences };
export type Me = { user: User | null };

// X-Client-Id lets the API move this browser's anonymous focus sessions into the account.
const withClient = () => ({ "X-Client-Id": clientId(), "X-Time-Zone": timeZone() });

export async function register(input: { name: string; email: string; password: string }): Promise<User> {
  const res = await apiFetch<{ user: User }>("/api/auth/register", {
    method: "POST",
    headers: withClient(),
    body: JSON.stringify(input),
  });
  return res.user;
}

export async function login(input: { email: string; password: string }): Promise<User> {
  const res = await apiFetch<{ user: User }>("/api/auth/login", {
    method: "POST",
    headers: withClient(),
    body: JSON.stringify(input),
  });
  return res.user;
}

export function logout(): Promise<void> {
  return apiFetch<void>("/api/auth/logout", { method: "POST" });
}

// Save settings to the account, so they follow you to other devices (signed in only).
export async function savePreferences(preferences: Preferences): Promise<User> {
  const res = await apiFetch<{ user: User }>("/api/me/preferences", { method: "PUT", body: JSON.stringify(preferences) });
  return res.user;
}
