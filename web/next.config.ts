import type { NextConfig } from "next";

// Where the Next.js server finds the API. The browser never needs to know.
// 127.0.0.1 rather than "localhost": some computers resolve localhost to IPv6 (::1),
// but the API only listens on 127.0.0.1.
const API_URL = process.env.API_URL ?? "http://127.0.0.1:4000";
// Stage 22: the game server (Nook Arena), a separate program. Caddy sends /api/arena there in Docker.
const ARENA_URL = process.env.ARENA_URL ?? "http://127.0.0.1:4100";

// Stage 12: the biggest song upload, in MB (the API checks the same number, MAX_UPLOAD_MB).
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 100);

const nextConfig: NextConfig = {
  // Stage 7: build a small self-contained server (.next/standalone) for the Docker image.
  output: "standalone",

  experimental: {
    // Stage 12 fix: when Next.js passes /api/* on to the API (below), it keeps only the first 10 MB
    // of a request unless told otherwise. Bigger songs were cut off, the API waited for the rest,
    // and after 30 s the upload failed ("can't reach Nook"). A little extra for the form fields.
    proxyClientMaxBodySize: `${MAX_UPLOAD_MB + 5}mb`,
    // Stage 19 (speed): put the CSS (about 16 KB) inside the HTML instead of a separate file the browser must
    // fetch before it can draw anything. Lighthouse counted that wait as ~0.3 s on a phone.
    inlineCss: true,
  },

  // Dev mode (npm run dev) only: let other PCs on a home/office network load the
  // live-reload scripts. `npm start` (production) doesn't need this.
  // Each * is one part of the address: 192.168.*.* matches 192.168.1.20.
  // Add others with DEV_ORIGINS, e.g. DEV_ORIGINS="100.64.*.*,mypc.lan" npm run dev
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    "*.local",
    ...(process.env.DEV_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  ],

  // Stage 4: the browser calls /api/* on THIS site, and Next.js forwards it to the API.
  // One origin for everything means:
  //   - the login cookie is a normal first-party cookie
  //   - no CORS needed
  //   - other PCs only need to reach port 3000; the API stays private on this computer
  // In Stage 7, Caddy does this job instead.
  async rewrites() {
    return [
      { source: "/api/arena", destination: `${ARENA_URL}/api/arena` }, // Stage 22: game server (first: more specific)
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
    ];
  },

  // Stage 3.5 moved Tips inside Chill Corner; Stage 29 renamed Chill Corner to Focus Room (/focus).
  // Old links keep working with a permanent (308) redirect.
  async redirects() {
    return [
      { source: "/tips", destination: "/focus/tips", permanent: true },
      { source: "/tips/:slug", destination: "/focus/tips/:slug", permanent: true },
      { source: "/chill", destination: "/focus", permanent: true },
      { source: "/chill/:path*", destination: "/focus/:path*", permanent: true },
      // Stage 28: private chats became their own app
      { source: "/hobby-hub/messages", destination: "/messages", permanent: true },
      { source: "/hobby-hub/messages/:userId", destination: "/messages/:userId", permanent: true },
    ];
  },
};

export default nextConfig;
