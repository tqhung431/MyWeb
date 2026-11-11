// Sign-in calls made from the browser. The API answers with Set-Cookie;
// the browser stores the httpOnly cookie itself. Our JavaScript never touches the token.

import { apiFetch } from "./client";
import { clientId } from "./clientId";

export type User = { id: string; email: string; name: string; avatarUrl: string | null; createdAt: string };
export type Me = { user: User | null; methods?: { password: boolean; providers: string[] } };
export type Providers = { password: boolean; github: boolean };

// X-Client-Id lets the API move this browser's anonymous focus sessions into the account.
const withClient = () => ({ "X-Client-Id": clientId() });

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

// A full-page navigation (not fetch): the browser has to visit GitHub itself.
export function githubLoginUrl(next: string): string {
  return `/api/auth/github?${new URLSearchParams({ next, clientId: clientId() })}`;
}
