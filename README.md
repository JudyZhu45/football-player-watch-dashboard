# Football Player Watch Dashboard

Monorepo for a near-live football player watch app.

## Apps

- `apps/web`: Next.js + Tailwind frontend deployed to Vercel
- `apps/worker`: Railway worker that polls `football-data.org` and writes to Supabase

## Infrastructure

- `Supabase`: Postgres, Auth, Realtime
- `football-data.org`: upstream match source

## Local setup

1. Copy `.env.example` to the app env files you need.
2. Install dependencies with `pnpm install`.
3. Apply Supabase migrations.
4. Run `pnpm dev`.

