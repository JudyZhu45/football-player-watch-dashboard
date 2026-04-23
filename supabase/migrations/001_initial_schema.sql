begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  external_id integer not null unique,
  name text not null,
  code text,
  type text,
  emblem_url text,
  area_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  external_id integer not null unique,
  name text not null,
  short_name text,
  tla text,
  crest_url text,
  venue text,
  founded integer,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  external_id integer not null unique,
  name text not null,
  first_name text,
  last_name text,
  date_of_birth date,
  nationality text,
  position text,
  shirt_number integer,
  current_team_id uuid references public.teams(id) on delete set null,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  external_id integer not null unique,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  home_team_id uuid not null references public.teams(id) on delete restrict,
  away_team_id uuid not null references public.teams(id) on delete restrict,
  utc_date timestamptz not null,
  status text not null,
  matchday integer,
  stage text,
  venue text,
  home_score integer not null default 0,
  away_score integer not null default 0,
  winner text,
  last_polled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  event_type text not null,
  minute integer,
  second integer,
  period text,
  detail text,
  external_event_key text unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.match_player_selections (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  role text not null,
  is_starting boolean not null default false,
  is_captain boolean not null default false,
  shirt_number integer,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create table if not exists public.player_match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  minutes_played integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  started boolean not null default false,
  subbed_in_minute integer,
  subbed_out_minute integer,
  updated_from_source_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null,
  request_count integer not null default 0,
  row_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  favorite_team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_favorite_players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, player_id)
);

create table if not exists public.user_favorite_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, team_id)
);

create table if not exists public.user_favorite_competitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, competition_id)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  favorite_view text not null default 'players',
  timezone text not null default 'UTC',
  show_finished_matches boolean not null default true,
  show_only_live_matches boolean not null default false,
  accent_team_id uuid references public.teams(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_matches_competition_utc_date on public.matches (competition_id, utc_date desc);
create index if not exists idx_matches_status_utc_date on public.matches (status, utc_date desc);
create index if not exists idx_match_events_match_id_created_at on public.match_events (match_id, created_at desc);
create index if not exists idx_match_player_selections_player_id on public.match_player_selections (player_id);
create index if not exists idx_player_match_stats_player_id on public.player_match_stats (player_id);
create index if not exists idx_user_favorite_players_user_id on public.user_favorite_players (user_id);
create index if not exists idx_user_favorite_teams_user_id on public.user_favorite_teams (user_id);
create index if not exists idx_user_favorite_competitions_user_id on public.user_favorite_competitions (user_id);

drop trigger if exists competitions_set_updated_at on public.competitions;
create trigger competitions_set_updated_at
before update on public.competitions
for each row execute function public.set_updated_at();

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at
before update on public.players
for each row execute function public.set_updated_at();

drop trigger if exists matches_set_updated_at on public.matches;
create trigger matches_set_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

drop trigger if exists player_match_stats_set_updated_at on public.player_match_stats;
create trigger player_match_stats_set_updated_at
before update on public.player_match_stats
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.competitions enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.match_player_selections enable row level security;
alter table public.player_match_stats enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.profiles enable row level security;
alter table public.user_favorite_players enable row level security;
alter table public.user_favorite_teams enable row level security;
alter table public.user_favorite_competitions enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists "authenticated users can read competitions" on public.competitions;
create policy "authenticated users can read competitions"
on public.competitions
for select
to authenticated
using (true);

drop policy if exists "authenticated users can read teams" on public.teams;
create policy "authenticated users can read teams"
on public.teams
for select
to authenticated
using (true);

drop policy if exists "authenticated users can read players" on public.players;
create policy "authenticated users can read players"
on public.players
for select
to authenticated
using (true);

drop policy if exists "authenticated users can read matches" on public.matches;
create policy "authenticated users can read matches"
on public.matches
for select
to authenticated
using (true);

drop policy if exists "authenticated users can read match events" on public.match_events;
create policy "authenticated users can read match events"
on public.match_events
for select
to authenticated
using (true);

drop policy if exists "authenticated users can read match selections" on public.match_player_selections;
create policy "authenticated users can read match selections"
on public.match_player_selections
for select
to authenticated
using (true);

drop policy if exists "authenticated users can read player match stats" on public.player_match_stats;
create policy "authenticated users can read player match stats"
on public.player_match_stats
for select
to authenticated
using (true);

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "users can read own favorite players" on public.user_favorite_players;
create policy "users can read own favorite players"
on public.user_favorite_players
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can manage own favorite players" on public.user_favorite_players;
create policy "users can manage own favorite players"
on public.user_favorite_players
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can read own favorite teams" on public.user_favorite_teams;
create policy "users can read own favorite teams"
on public.user_favorite_teams
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can manage own favorite teams" on public.user_favorite_teams;
create policy "users can manage own favorite teams"
on public.user_favorite_teams
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can read own favorite competitions" on public.user_favorite_competitions;
create policy "users can read own favorite competitions"
on public.user_favorite_competitions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can manage own favorite competitions" on public.user_favorite_competitions;
create policy "users can manage own favorite competitions"
on public.user_favorite_competitions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can read own preferences" on public.user_preferences;
create policy "users can read own preferences"
on public.user_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can manage own preferences" on public.user_preferences;
create policy "users can manage own preferences"
on public.user_preferences
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.matches;
  exception
    when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.match_events;
  exception
    when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.player_match_stats;
  exception
    when duplicate_object then null;
  end;
end
$$;

commit;
