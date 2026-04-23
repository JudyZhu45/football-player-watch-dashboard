import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <section className="grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <p className="inline-flex rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-2 text-sm text-[var(--muted)]">
          Near-live football tracking with worker-driven updates
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-[var(--foreground)] md:text-7xl">
          Follow your favorite football players without refreshing the page.
        </h1>
        <p className="max-w-2xl text-lg text-[var(--muted)]">
          Railway polls football-data.org, Supabase stores normalized match
          data, and Realtime pushes updates into a personalized Next.js
          dashboard.
        </p>
        <div className="flex gap-3">
          <Link href="/sign-up">
            <Button>Create account</Button>
          </Link>
          <Link href="/dashboard" className="rounded-full border border-[var(--panel-border)] px-5 py-2 text-sm font-semibold">
            Open dashboard
          </Link>
        </div>
      </div>
      <div className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm backdrop-blur">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
          Planned stack
        </p>
        <ul className="mt-6 space-y-4 text-sm text-[var(--foreground)]">
          <li>Next.js App Router + Tailwind CSS</li>
          <li>Supabase Postgres + Realtime + Auth</li>
          <li>Railway worker polling football-data.org</li>
          <li>Favorites and personalized player watch feeds</li>
        </ul>
      </div>
    </section>
  );
}

