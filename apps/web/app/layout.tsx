import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/nextjs';

import './globals.css';

export const metadata: Metadata = {
  title: 'Football Player Watch',
  description: 'Near-live football dashboard powered by Supabase Realtime.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en">
        <body>
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
            <header className="mb-10 flex items-center justify-between">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Football Player Watch
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                <Show when="signed-in">
                  <Link href="/dashboard" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                    Dashboard
                  </Link>
                  <Link href="/settings" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                    Settings
                  </Link>
                  <UserButton />
                </Show>
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button className="text-[var(--muted)] hover:text-[var(--foreground)]">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-strong)]">
                      Create account
                    </button>
                  </SignUpButton>
                </Show>
              </nav>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
