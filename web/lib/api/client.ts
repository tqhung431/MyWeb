// One place that knows how to call the API. Every feature's API file uses apiFetch().
//
// It handles, once for all features:
// - which address to call (Next.js server vs browser)
// - a timeout, so a stuck API can't hang a page forever
// - turning a non-2xx answer into an ApiError with its status code and message

// Browser: same origin ("/api/..."); next.config.ts forwards it to the API, cookies included.
// Next.js server: call the API directly.
function baseUrl(): string {
  return typeof window === "undefined" ? (process.env.API_URL ?? "http://localhost:4000") : "";
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Options = RequestInit & { timeoutMs?: number };

export async function apiFetch<T>(path: string, { timeoutMs = 5000, headers, ...init }: Options = {}): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    cache: "no-store", // always ask the API; it decides what's fresh
    ...init,
    headers: { "Content-Type": "application/json", ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `API answered ${res.status}`, body.details);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
