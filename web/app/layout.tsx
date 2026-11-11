// Root layout: a Server Component that wraps every page.
// It renders once on the server; only the parts marked "use client" ship JavaScript.

import type { Metadata } from "next";
import Link from "next/link";
import { ChillProvider } from "@/components/ChillProvider";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chill Corner · MyWeb",
  description: "A calm corner of the web: ambient sounds and a focus timer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>

        <header className="site-header">
          <Link className="brand" href="/">
            🌙 Chill Corner
          </Link>
          <Nav />
        </header>

        {/* Client provider wrapping server-rendered pages: state survives page changes */}
        <ChillProvider>
          <main id="main">{children}</main>
        </ChillProvider>

        <footer className="site-footer">
          <p>
            Part of <strong>MyWeb</strong> · Stage 3 · <Link href="/about">Credits</Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
