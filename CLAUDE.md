# Football Player Watch Dashboard

## Goal

Build a multi-server web application where:

- a background worker polls `football-data.org`
- the worker normalizes and writes match data into Supabase
- a Next.js frontend reads from Supabase
- Supabase Realtime pushes updates to signed-in users without page refresh
- users can follow favorite players, teams, and competitions

This project is designed to satisfy the course requirements while staying realistic for a solo homework build.

## Product Scope

The app is a live football player watch dashboard.

A user can:

- sign up and sign in
- choose favorite players
- optionally choose favorite teams and competitions
- view a live or recent match card for watched players
- see match timeline updates like goals, cards, substitutions, and status changes
- see a personalized home feed filtered by their saved preferences

Because `football-data.org` is stable and free but not full high-frequency event streaming on the free tier, the app should be positioned as a near-live dashboard with scheduled refreshes.

## Tech Stack

- Monorepo with `apps/web` and `apps/worker`
- `Next.js` for frontend
- `Tailwind CSS` for styling
- `Supabase` for Postgres, auth or profile storage, and Realtime
- `Railway` for the polling worker
- `Vercel` for the frontend
- `football-data.org` as the external data source
- Authentication via `Supabase Auth` or `Clerk`

Recommendation: use `Supabase Auth` to reduce moving parts unless the class specifically wants Clerk.

## Monorepo Layout

```text
football-player-watch-dashboard/
  apps/
    web/
      app/
      components/
      lib/
      public/
      package.json
      tailwind.config.ts
      next.config.ts
    worker/
      src/
        jobs/
        lib/
        index.ts
      package.json
  packages/
    config/
    types/
    utils/
  supabase/
    migrations/
    seed.sql
  .env.example
  CLAUDE.md
  package.json
  pnpm-workspace.yaml
  turbo.json
```

Use `pnpm` workspaces and `turbo` for a clean monorepo story.

## High-Level Architecture

```text
football-data.org
  -> Railway worker poll cycle
  -> normalization and upsert logic
  -> Supabase Postgres tables
  -> Supabase Realtime broadcasts row changes
  -> Next.js app subscriptions refresh UI
  -> signed-in users see personalized player watch dashboards
```

The worker is the only component allowed to write football source data into the database. The frontend reads public football data and writes only user-owned preference data.

## Worker Responsibilities

The worker runs as a long-lived background service on Railway.

Main jobs:

- poll scheduled matches for selected competitions
- poll live or recent matches more frequently than inactive matches
- fetch teams, standings, scorers, and player-related match context as needed
- normalize API responses into internal relational tables
- upsert changed rows only
- write ingestion logs for observability
- mark stale matches for backfill or slower polling

Suggested polling strategy:

- every 15 minutes: refresh competitions and scheduled matches for the next 7 days
- every 60 seconds: refresh matches whose status is `LIVE`, `IN_PLAY`, or `PAUSED`
- every 5 minutes: refresh matches finished in the last 3 hours
- every 12 hours: backfill teams and player metadata for watched entities

Because free-tier rate limits exist, the worker should not poll every possible match. It should poll only:

- competitions you support in the app
- matches involving user-favorited teams
- matches involving user-favorited players when derivable from lineup data
- recently active matches

## Worker Data Pipeline

Each poll cycle should follow this order:

1. Load tracked competitions and active watch targets from Supabase.
2. Compute which API endpoints need to be called this cycle.
3. Fetch data from `football-data.org` with retry and rate-limit awareness.
4. Transform external payloads into app-level records.
5. Upsert base entities first: competitions, teams, players, matches.
6. Upsert dependent entities next: lineups, player match stats, match events, score snapshots.
7. Insert an ingestion run record with counts, latency, and errors.
8. Let Supabase Realtime propagate row changes to subscribed frontend clients.

## Recommended Feature Definition

Since `football-data.org` is not a rich event-by-event player tracking feed, define "Player Watch" as:

- player identity and team
- upcoming and current match
- lineup status if available
- goals
- cards
- substitutions in and out
- match status
- scoreline
- recent match timeline entries tied to the match

This is honest, stable, and achievable.

## Database Tables

Use a normalized schema with clear ownership boundaries.

### Source Data Tables

#### `competitions`

- `id` uuid primary key
- `external_id` integer unique not null
- `name` text not null
- `code` text
- `type` text
- `emblem_url` text
- `area_name` text
- `is_active` boolean default true
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

#### `teams`

- `id` uuid primary key
- `external_id` integer unique not null
- `name` text not null
- `short_name` text
- `tla` text
- `crest_url` text
- `venue` text
- `founded` integer
- `website` text
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

#### `players`

- `id` uuid primary key
- `external_id` integer unique not null
- `name` text not null
- `first_name` text
- `last_name` text
- `date_of_birth` date
- `nationality` text
- `position` text
- `shirt_number` integer
- `current_team_id` uuid references teams(id)
- `photo_url` text nullable
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

#### `matches`

- `id` uuid primary key
- `external_id` integer unique not null
- `competition_id` uuid references competitions(id) not null
- `home_team_id` uuid references teams(id) not null
- `away_team_id` uuid references teams(id) not null
- `utc_date` timestamptz not null
- `status` text not null
- `matchday` integer
- `stage` text
- `venue` text
- `home_score` integer default 0
- `away_score` integer default 0
- `winner` text nullable
- `last_polled_at` timestamptz
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

#### `match_events`

- `id` uuid primary key
- `match_id` uuid references matches(id) not null
- `player_id` uuid references players(id)
- `team_id` uuid references teams(id)
- `event_type` text not null
- `minute` integer
- `second` integer nullable
- `period` text nullable
- `detail` text
- `external_event_key` text unique
- `payload` jsonb not null default '{}'::jsonb
- `created_at` timestamptz default now()

Use this table for goals, bookings, substitutions, and notable state changes if the source supports them. If the API does not provide detailed events for all matches, insert only what is available and keep the payload raw for traceability.

#### `match_player_selections`

- `id` uuid primary key
- `match_id` uuid references matches(id) not null
- `player_id` uuid references players(id) not null
- `team_id` uuid references teams(id) not null
- `role` text not null
- `is_starting` boolean default false
- `is_captain` boolean default false
- `shirt_number` integer nullable
- `created_at` timestamptz default now()
- unique `(match_id, player_id)`

This table represents lineup and bench membership for a match.

#### `player_match_stats`

- `id` uuid primary key
- `match_id` uuid references matches(id) not null
- `player_id` uuid references players(id) not null
- `team_id` uuid references teams(id) not null
- `minutes_played` integer default 0
- `goals` integer default 0
- `assists` integer default 0
- `yellow_cards` integer default 0
- `red_cards` integer default 0
- `started` boolean default false
- `subbed_in_minute` integer nullable
- `subbed_out_minute` integer nullable
- `updated_from_source_at` timestamptz
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()
- unique `(match_id, player_id)`

Keep this schema conservative. Only store columns the API can reliably populate.

#### `ingestion_runs`

- `id` uuid primary key
- `job_name` text not null
- `started_at` timestamptz not null
- `finished_at` timestamptz
- `status` text not null
- `request_count` integer default 0
- `row_count` integer default 0
- `error_message` text nullable
- `metadata` jsonb not null default '{}'::jsonb

This is useful for debugging during demo week.

### User Tables

If you use Supabase Auth, the auth user lives in `auth.users`. Create app-level profile and preference tables in `public`.

#### `profiles`

- `id` uuid primary key references auth.users(id)
- `username` text unique
- `display_name` text
- `favorite_team_id` uuid references teams(id) nullable
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

#### `user_favorite_players`

- `id` uuid primary key
- `user_id` uuid references profiles(id) not null
- `player_id` uuid references players(id) not null
- `created_at` timestamptz default now()
- unique `(user_id, player_id)`

#### `user_favorite_teams`

- `id` uuid primary key
- `user_id` uuid references profiles(id) not null
- `team_id` uuid references teams(id) not null
- `created_at` timestamptz default now()
- unique `(user_id, team_id)`

#### `user_favorite_competitions`

- `id` uuid primary key
- `user_id` uuid references profiles(id) not null
- `competition_id` uuid references competitions(id) not null
- `created_at` timestamptz default now()
- unique `(user_id, competition_id)`

#### `user_preferences`

- `user_id` uuid primary key references profiles(id)
- `favorite_view` text default 'players'
- `timezone` text default 'UTC'
- `show_finished_matches` boolean default true
- `show_only_live_matches` boolean default false
- `accent_team_id` uuid references teams(id) nullable
- `updated_at` timestamptz default now()

## Row Level Security

Enable RLS on all user-owned tables.

Policies:

- public football tables are readable by authenticated users
- worker writes with service role key
- users can read and write only their own rows in `profiles`, favorites, and preferences

Do not expose the Supabase service role key to the frontend.

## Supabase Realtime Design

Enable Realtime for:

- `matches`
- `match_events`
- `player_match_stats`

Frontend subscriptions:

- subscribe to changes on matches involving watched players or watched teams
- subscribe to match events for the currently open match detail page
- subscribe to player stat updates for favorited players

Expected UI behavior:

- scoreline changes update automatically
- match status changes from scheduled to live to finished
- timeline entries appear as new events are inserted
- player watch cards update without manual refresh

## Frontend Responsibilities

The Next.js app should do the following:

- handle sign up and sign in
- let users search and favorite players, teams, and competitions
- render personalized dashboards
- subscribe to Supabase Realtime channels
- use server components for initial data load where possible
- use client components only for live subscriptions and interaction-heavy widgets

Recommended pages:

- `/` landing page
- `/sign-in`
- `/sign-up`
- `/dashboard` personalized player watch feed
- `/players/[id]` player detail with recent and current match context
- `/matches/[id]` live match timeline
- `/settings` preferences and favorites management

## Screen Data Flow

### Dashboard Flow

1. User signs in.
2. Frontend loads the user's favorites and preferences from Supabase.
3. Frontend queries the latest relevant players, matches, and player stats.
4. Client subscribes to Realtime on watched match IDs.
5. When the worker writes new score, event, or stat rows, Supabase pushes the updates.
6. UI patches the live cards and timeline components without full page refresh.

### Match Detail Flow

1. User opens a match page.
2. Frontend fetches match header, teams, score, lineup, player stats, and existing events.
3. Client subscribes to `match_events` and `matches` for that match.
4. Worker inserts new event rows or updates match status and score.
5. Realtime event arrives and the timeline rerenders immediately.

## API Integration Notes

Use `football-data.org` for:

- competitions
- teams
- standings if needed later
- matches by competition
- match details
- squad data where available

Design the worker so source-specific fetch functions are isolated in one module. That way, if you ever switch APIs later, you only replace the source adapter layer rather than the whole app.

## Railway Worker Design

The worker should be a lightweight Node process.

Suggested structure:

```text
apps/worker/src/
  index.ts
  lib/
    env.ts
    footballDataClient.ts
    supabaseAdmin.ts
    logger.ts
  jobs/
    syncCompetitions.ts
    syncScheduledMatches.ts
    syncLiveMatches.ts
    syncTeamsAndPlayers.ts
```

`index.ts` should:

- boot the process
- validate env vars
- start cron-like intervals
- run jobs sequentially or with bounded concurrency
- catch and log errors without killing the whole service

Important guardrails:

- implement retry with backoff for 429 and 5xx responses
- cap concurrency to avoid blowing rate limits
- use idempotent upserts
- record `last_polled_at` so you can debug freshness

## Next.js Web Design

Suggested structure:

```text
apps/web/
  app/
    (marketing)/
    (auth)/
    dashboard/
    players/[id]/
    matches/[id]/
    settings/
  components/
    dashboard/
    match/
    player/
    ui/
  lib/
    supabase/
    auth/
    queries/
    realtime/
```

Tailwind should be used for all styling. Keep the UI focused on:

- live status badges
- score cards
- event timelines
- player summary cards
- preference chips for favorites

## Authentication Choice

Preferred choice: `Supabase Auth`

Why:

- simpler integration with Supabase database and RLS
- fewer services to configure
- easier for a homework project

Alternative: `Clerk`

Use Clerk only if:

- you want better out-of-the-box auth UI
- you are comfortable wiring Clerk identities to Supabase profiles

If using Clerk, you still need a stable mapping between Clerk user IDs and your app profile table.

## Environment Variables

Local development should use `.env.local` in `apps/web` and `apps/worker` or a shared root env strategy.

Required variables:

### Web

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` only if server-side admin tasks are needed in web
- `NEXT_PUBLIC_AUTH_PROVIDER`

If using Supabase Auth only, the web app often does not need the service role key.

### Worker

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FOOTBALL_DATA_API_KEY`
- `POLL_COMPETITION_CODES`
- `NODE_ENV`

### Platform Dashboards

Set the same values in:

- Vercel project settings for `apps/web`
- Railway service variables for `apps/worker`
- Supabase dashboard for database and Realtime configuration

Never commit real secrets.

## Supabase MCP Server

This project requires the Supabase MCP server to be configured so schema inspection and database workflows can be assisted during development.

At minimum, use the MCP server for:

- checking schema and migrations
- validating table names and foreign keys
- inspecting RLS policies
- verifying Realtime-enabled tables

## Deployment Plan

### Vercel

Deploy `apps/web` to Vercel.

Requirements:

- set root directory to `apps/web` if using monorepo-aware config
- configure all frontend env vars
- ensure Next.js build succeeds from monorepo root

### Railway

Deploy `apps/worker` to Railway.

Requirements:

- start command runs the worker entry point
- env vars include Supabase service key and football API key
- process stays alive and keeps polling

### Supabase

Use Supabase for:

- Postgres
- auth
- Realtime
- SQL migrations

Your classmates should be able to:

- open the Vercel URL
- create an account
- choose favorites
- see updates flow into the dashboard

## Git Strategy

You need multiple commits showing iteration. A good commit sequence is:

1. `chore: initialize monorepo with web and worker apps`
2. `feat: add supabase schema and auth setup`
3. `feat: implement football data polling worker`
4. `feat: add personalized player dashboard`
5. `feat: enable realtime match updates`
6. `deploy: configure vercel and railway`

## Minimum Viable Demo

To keep scope under control, the MVP should include:

- authentication
- ability to favorite players
- worker polling football matches for selected competitions
- Supabase tables populated with players, matches, and events
- dashboard showing watched players and their current or latest match
- live updates via Supabase Realtime

Do not overbuild analytics that the source API cannot support reliably.

## Nice-to-Have Features

- a "live now" tab
- team pages
- standings sidebar
- event filters
- favorite competitions onboarding
- admin debug page showing latest ingestion run

## Non-Goals

Avoid these unless there is extra time:

- custom websocket server
- direct browser polling of `football-data.org`
- complex event sourcing
- advanced per-touch player heatmaps
- push notifications

These are not necessary for the assignment and increase risk.

## Build Rules

- frontend never calls `football-data.org` directly
- only worker writes source football data
- all shared types should live in `packages/types`
- all timestamps stored in UTC
- all upserts must be idempotent
- every table should have `created_at` and `updated_at` where appropriate

## Final Architecture Summary

This system has three main parts:

1. `apps/worker` on Railway polls `football-data.org`, transforms source data, and writes normalized rows into Supabase.
2. `Supabase` stores both football data and user preference data, enforces auth rules, and broadcasts row changes through Realtime.
3. `apps/web` on Vercel reads from Supabase, subscribes to live updates, and renders a personalized football player watch experience for each signed-in user.

This is the blueprint to implement.
