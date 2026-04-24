import { auth } from '@clerk/nextjs/server';

import { createAdminClient } from '../supabase/admin';
import { getOrCreateProfileId } from '../auth/profile';

// ── Types ─────────────────────────────────────────────────────────────────────

type TeamRef = { name: string; tla: string | null; crest_url: string | null };

export type MatchContext = {
  id: string;
  status: string;
  utc_date: string;
  home_score: number;
  away_score: number;
  is_starting: boolean;
  home_team: TeamRef;
  away_team: TeamRef;
};

export type WatchedPlayer = {
  id: string;
  name: string;
  position: string | null;
  nationality: string | null;
  shirt_number: number | null;
  team: TeamRef | null;
  match: MatchContext | null;
};

const STATUS_ORDER: Record<string, number> = {
  IN_PLAY: 0,
  LIVE: 0,
  PAUSED: 1,
  TIMED: 2,
  SCHEDULED: 2,
  FINISHED: 3,
};

type RawMatch = {
  id: string;
  status: string;
  utc_date: string;
  home_score: number;
  away_score: number;
  home_team_id: string;
  away_team_id: string;
  home_team: TeamRef;
  away_team: TeamRef;
};

function pickBestMatch(
  selMap: Map<string, boolean>,
  matchMap: Map<string, RawMatch>,
): MatchContext | null {
  let best: MatchContext | null = null;
  let bestOrder = Infinity;

  for (const [matchId, isStarting] of selMap) {
    const m = matchMap.get(matchId);
    if (!m) continue;
    const order = STATUS_ORDER[m.status] ?? 10;
    if (order < bestOrder || (order === bestOrder && m.utc_date > (best?.utc_date ?? ''))) {
      best = { ...m, is_starting: isStarting };
      bestOrder = order;
    }
  }
  return best;
}

// ── Query ─────────────────────────────────────────────────────────────────────

export async function getDashboardData() {
  const { userId } = await auth();
  if (!userId) return null;

  const profileId = await getOrCreateProfileId();
  if (!profileId) return null;

  const supabase = createAdminClient();

  const { data: favorites } = await supabase
    .from('user_favorite_players')
    .select('player_id')
    .eq('user_id', profileId);

  const favoriteIds = (favorites ?? []).map((f) => f.player_id as string);

  if (favoriteIds.length === 0) {
    return { watchedPlayers: [] as WatchedPlayer[] };
  }

  const { data: playersData } = await supabase
    .from('players')
    .select(
      'id, name, position, nationality, shirt_number, current_team_id, team:teams!players_current_team_id_fkey (name, tla, crest_url)',
    )
    .in('id', favoriteIds);

  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const sevenDaysAhead = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const { data: recentMatches } = await supabase
    .from('matches')
    .select(
      'id, status, utc_date, home_score, away_score, home_team_id, away_team_id, home_team:teams!matches_home_team_id_fkey (name, tla, crest_url), away_team:teams!matches_away_team_id_fkey (name, tla, crest_url)',
    )
    .gte('utc_date', threeDaysAgo)
    .lte('utc_date', sevenDaysAhead)
    .limit(300);

  const matchMap = new Map(
    (recentMatches ?? []).map((m) => [m.id as string, m as unknown as RawMatch]),
  );
  const recentMatchIds = Array.from(matchMap.keys());

  // Build team → match_ids index for fallback lookup
  const teamMatchIds = new Map<string, string[]>();
  for (const m of matchMap.values()) {
    for (const tid of [m.home_team_id, m.away_team_id]) {
      if (!tid) continue;
      if (!teamMatchIds.has(tid)) teamMatchIds.set(tid, []);
      teamMatchIds.get(tid)!.push(m.id);
    }
  }

  const { data: selections } =
    recentMatchIds.length > 0
      ? await supabase
          .from('match_player_selections')
          .select('player_id, match_id, is_starting')
          .in('player_id', favoriteIds)
          .in('match_id', recentMatchIds)
      : { data: [] };

  const selsByPlayer = new Map<string, Map<string, boolean>>();
  for (const sel of selections ?? []) {
    const pid = sel.player_id as string;
    if (!selsByPlayer.has(pid)) selsByPlayer.set(pid, new Map());
    selsByPlayer.get(pid)!.set(sel.match_id as string, sel.is_starting as boolean);
  }

  const watchedPlayers: WatchedPlayer[] = (playersData ?? []).map((p) => {
    const selMap = selsByPlayer.get(p.id as string);
    let matchContext: MatchContext | null = null;

    if (selMap && selMap.size > 0) {
      // Prefer selection-based match (we know the player participated)
      matchContext = pickBestMatch(selMap, matchMap);
    } else {
      // Fallback: any match involving the player's current team
      const teamId = p.current_team_id as string | null;
      if (teamId) {
        const mids = teamMatchIds.get(teamId) ?? [];
        const teamSelMap = new Map(mids.map((mid) => [mid, false] as [string, boolean]));
        matchContext = pickBestMatch(teamSelMap, matchMap);
      }
    }

    return {
      id: p.id as string,
      name: p.name as string,
      position: p.position as string | null,
      nationality: p.nationality as string | null,
      shirt_number: p.shirt_number as number | null,
      team: p.team as unknown as TeamRef | null,
      match: matchContext,
    };
  });

  return { watchedPlayers };
}
