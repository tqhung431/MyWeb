// Root layout: wraps every page of every app.
//
//   AppProviders (client: sound + timer state, shared by all pages)
//   └─ Sidebar (desktop) | page content | MiniPlayer | BottomNav (phone)
//
// It's a Server Component; only the pieces marked "use client" ship JavaScript.
// Stage 4: it asks the API "who is this?" (with the visitor's cookie) on every request,
// so pages are rendered per visitor, and the first HTML already shows your name.

import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/shell/AppProviders";
import { Aurora } from "@/components/shell/Aurora";
import { BottomNav } from "@/components/shell/BottomNav";
import { Brand } from "@/components/shell/Brand";
import { MiniPlayer } from "@/components/shell/MiniPlayer";
import { MusicDock } from "@/features/music/MusicDock";
import { Sidebar } from "@/components/shell/Sidebar";
import { UserMenu } from "@/features/me/UserMenu";
import { themeScript } from "@/features/theme/theme";
import { ThemeSwitcher } from "@/features/theme/ThemeSwitcher";
import { getMe } from "@/lib/api/server";
import "./globals.css";

// Downloaded at build time and served from our own site (no request to Google from the browser).
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "vietnamese"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Nook", template: "%s · Nook" },
  description: "Small, calm apps for your free time: focus, games, watch-lists and more.",
  // Stage 13: "Add to Home Screen" on iPhones uses these
  appleWebApp: { capable: true, title: "Nook", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0915" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getMe();

  return (
    // suppressHydrationWarning: the theme script changes <html> before React loads, on purpose.
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before the first paint (no white flash in dark mode) */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <a
          href="#main"
          className="sr-only z-50 rounded-xl bg-surface-strong px-4 py-2 focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Skip to content
        </a>
        <Aurora />

        <AppProviders initialUser={user}>
          <div className="lg:grid lg:grid-cols-[17rem_1fr]">
            <Sidebar />

            <div className="min-w-0">
              {/* Phone header (the sidebar replaces it on desktop) */}
              <header className="flex items-center justify-between px-4 pt-5 lg:hidden">
                <Brand />
                <div className="flex items-center gap-2">
                  <ThemeSwitcher compact />
                  <UserMenu compact />
                </div>
              </header>

              <main id="main" className="mx-auto max-w-6xl px-4 pt-6 pb-44 sm:px-6 lg:px-10 lg:pt-10 lg:pb-32">
                {children}
              </main>
            </div>
          </div>

          <MiniPlayer />
          <MusicDock />
          <BottomNav />
        </AppProviders>
      </body>
    </html>
  );
}
