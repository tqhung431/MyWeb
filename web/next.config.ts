import type { NextConfig } from "next";

// Where the Next.js server finds the API. The browser never needs to know.
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // Stage 4: the browser calls /api/* on THIS site, and Next.js forwards it to the API.
  // One origin for everything means:
  //   - the login cookie is a normal first-party cookie
  //   - no CORS needed
  //   - GitHub can send people back to http://localhost:3000/api/auth/github/callback
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
