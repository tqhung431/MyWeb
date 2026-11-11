import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stage 3.5 moved Tips inside Chill Corner. Old links keep working with a permanent (308) redirect.
  async redirects() {
    return [
      { source: "/tips", destination: "/chill/tips", permanent: true },
      { source: "/tips/:slug", destination: "/chill/tips/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
