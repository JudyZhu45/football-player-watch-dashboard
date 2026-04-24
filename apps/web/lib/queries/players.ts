import { createAdminClient } from '../supabase/admin';

export async function getPlayerDetail(id: string) {
  const supabase = createAdminClient();

  const { data: player } = await supabase
    .from('players')
    .select(
      'id, name, position, nationality, date_of_birth, shirt_number, team:teams!players_current_team_id_fkey (id, name, short_name, tla, crest_url, venue)',
    )
    .eq('id', id)
    .single();

  if (!player) return null;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const sevenDaysAhead = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const { data: recentMatchIds } = await supabase
    .from('matches')
    .select('id')
    .gte('utc_date', thirtyDaysAgo)
    .lte('utc_date', sevenDaysAhead)
    .limit(100);

  const matchIds = (recentMatchIds ?? []).map((m) => m.id as string);

  const { data: selections } =
    matchIds.length > 0
      ? await supabase
          .from('match_player_selections')
          .select(
            'is_starting, is_captain, shirt_number, match:matches (id, status, utc_date, home_score, away_score, home_team:teams!matches_home_team_id_fkey (name, tla, crest_url), away_team:teams!matches_away_team_id_fkey (name, tla, crest_url))',
          )
          .eq('player_id', id)
          .in('match_id', matchIds)
          .limit(10)
      : { data: [] };

  const { data: events } = await supabase
    .from('match_events')
    .select(
      'id, event_type, minute, match:matches (id, utc_date, status, home_team:teams!matches_home_team_id_fkey (name, tla), away_team:teams!matches_away_team_id_fkey (name, tla))',
    )
    .eq('player_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  return {
    player,
    recentMatches: (selections ?? []).filter((s) => s.match !== null),
    events: events ?? [],
  };
}
