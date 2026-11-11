import type { NextConfig } from "next";

// Where the Next.js server finds the API. The browser never needs to know.
// 127.0.0.1 rather than "localhost": some computers resolve localhost to IPv6 (::1),
// but the API only listens on 127.0.0.1.
const API_URL = process.env.API_URL ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  // Stage 7: build a small self-contained server (.next/standalone) for the Docker image.
  output: "standalone",

  // Dev mode (npm run dev) only: let other PCs on a home/office network load the
  // live-reload scripts. `npm start` (production) doesn't need this.
  // Each * is one part of the address: 192.168.*.* matches 192.168.1.20.
  // Add others with DEV_ORIGINS, e.g. DEV_ORIGINS="100.64.*.*,mypc.lan" npm run dev
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    "*.local",
    ...(process.env.DEV_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
  ],

  // Stage 4: the browser calls /api/* on THIS site, and Next.js forwards it to the API.
  // One origin for everything means:
  //   - the login cookie is a normal first-party cookie
  //   - no CORS needed
  //   - other PCs only need to reach port 3000; the API stays private on this computer
  // In Stage 7, Caddy does this job instead.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },

  // Stage 3.5 moved Tips inside Chill Corner. Old links keep working with a permanent (308) redirect.
  async redirects() {
    return [
      { source: "/tips", destination: "/chill/tips", permanent: true },
      { source: "/tips/:slug", destination: "/chill/tips/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
