// Stage 13: the web app manifest. It lets phones "Add to Home Screen" and open Nook like an app,
// full screen, with its own icon. Served at /manifest.webmanifest.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nook",
    short_name: "Nook",
    description: "Small, calm apps for your free time",
    start_url: "/habits",
    scope: "/",
    display: "standalone",
    background_color: "#f5f3fb",
    theme_color: "#6e51ff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Habits today", url: "/habits" },
      { name: "Reading", url: "/habits/reading" },
    ],
  };
}
