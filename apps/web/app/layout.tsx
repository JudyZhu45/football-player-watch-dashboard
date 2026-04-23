import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Football Player Watch Dashboard",
  description: "A near-live football dashboard powered by Supabase Realtime."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
          <header className="mb-10 flex items-center justify-between">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Football Player Watch
            </Link>
            <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/settings">Settings</Link>
              <Link href="/sign-in">Sign in</Link>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

