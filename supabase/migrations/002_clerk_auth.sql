begin;

-- 1. Drop the FK that ties profiles.id to auth.users (Clerk uses string IDs)
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- 2. Add clerk_user_id lookup column
alter table public.profiles
  add column if not exists clerk_user_id text;

create unique index if not exists profiles_clerk_user_id_idx
  on public.profiles(clerk_user_id)
  where clerk_user_id is not null;

-- 3. Allow anon reads on public football data so the browser Supabase client
--    can run player-search queries without a Supabase session.
drop policy if exists "anon can read competitions" on public.competitions;
create policy "anon can read competitions"
  on public.competitions for select to anon using (true);

drop policy if exists "anon can read teams" on public.teams;
create policy "anon can read teams"
  on public.teams for select to anon using (true);

drop policy if exists "anon can read players" on public.players;
create policy "anon can read players"
  on public.players for select to anon using (true);

drop policy if exists "anon can read matches" on public.matches;
create policy "anon can read matches"
  on public.matches for select to anon using (true);

drop policy if exists "anon can read match events" on public.match_events;
create policy "anon can read match events"
  on public.match_events for select to anon using (true);

drop policy if exists "anon can read match player selections" on public.match_player_selections;
create policy "anon can read match player selections"
  on public.match_player_selections for select to anon using (true);

drop policy if exists "anon can read player match stats" on public.player_match_stats;
create policy "anon can read player match stats"
  on public.player_match_stats for select to anon using (true);

commit;
