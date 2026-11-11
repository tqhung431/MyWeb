// API calls made by the Next.js SERVER on behalf of a visitor.
//
// When a Server Component needs "who is this?", the browser's cookie is on the incoming
// page request, not on our server-to-API request. So we copy it across.
// Reading cookies makes the page dynamic: it's rendered per visitor, never shared.

import "server-only";
import { cookies } from "next/headers";
import { apiFetch } from "./client";
import type { Me, Providers } from "./auth";

async function withCookies(): Promise<HeadersInit> {
  return { cookie: (await cookies()).toString() };
}

export async function getMe(): Promise<Me> {
  try {
    return await apiFetch<Me>("/api/auth/me", { headers: await withCookies() });
  } catch {
    return { user: null }; // API down: treat as signed out, the page still renders
  }
}

export async function getProviders(): Promise<Providers> {
  try {
    return await apiFetch<Providers>("/api/auth/providers");
  } catch {
    return { password: true, github: false };
  }
}
