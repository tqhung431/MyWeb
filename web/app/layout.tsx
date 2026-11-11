// Root layout: wraps every page of every app.
//
//   AppProviders (client: sound + timer state, shared by all pages)
//   └─ Sidebar (desktop) | page content | MiniPlayer | BottomNav (phone)
//
// It's a Server Component; only the pieces marked "use client" ship JavaScript.

import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/shell/AppProviders";
import { Aurora } from "@/components/shell/Aurora";
import { BottomNav } from "@/components/shell/BottomNav";
import { Brand } from "@/components/shell/Brand";
import { MiniPlayer } from "@/components/shell/MiniPlayer";
import { Sidebar } from "@/components/shell/Sidebar";
import "./globals.css";

// Downloaded at build time and served from our own site (no request to Google from the browser).
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "vietnamese"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "MyWeb", template: "%s · MyWeb" },
  description: "Small, calm apps for your free time: focus, games, watch-lists and more.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0915" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh font-sans">
        <a
          href="#main"
          className="sr-only z-50 rounded-xl bg-surface-strong px-4 py-2 focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Skip to content
        </a>
        <Aurora />

        <AppProviders>
          <div className="lg:grid lg:grid-cols-[17rem_1fr]">
            <Sidebar />

            <div className="min-w-0">
              {/* Phone header (the sidebar replaces it on desktop) */}
              <header className="flex items-center px-4 pt-5 lg:hidden">
                <Brand />
              </header>

              <main id="main" className="mx-auto max-w-6xl px-4 pt-6 pb-44 sm:px-6 lg:px-10 lg:pt-10 lg:pb-32">
                {children}
              </main>
            </div>
          </div>

          <MiniPlayer />
          <BottomNav />
        </AppProviders>
      </body>
    </html>
  );
}
