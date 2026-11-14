// API calls made by the Next.js SERVER on behalf of a visitor.
//
// When a Server Component needs "who is this?", the browser's cookie is on the incoming
// page request, not on our server-to-API request. So we copy it across.
// Reading cookies makes the page dynamic: it's rendered per visitor, never shared.

import "server-only";
import { cookies } from "next/headers";
import { apiFetch } from "./client";
import type { Me } from "./me";

async function withCookies(): Promise<HeadersInit> {
  return { cookie: (await cookies()).toString() };
}

export async function getMe(): Promise<Me> {
  try {
    return await apiFetch<Me>("/api/me", { headers: await withCookies() });
  } catch {
    return { user: null }; // API down: treat as signed out, the page still renders
  }
}

// Stage 27: the admin's banner, in the first HTML so the page doesn't jump when it appears
export async function getServerBanner(): Promise<string | null> {
  try {
    return (await apiFetch<{ text: string | null }>("/api/banner")).text;
  } catch {
    return null;
  }
}
