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

  type PlayerTeam = { id: string };
  const teamId = (player.team as unknown as PlayerTeam | null)?.id ?? null;

  // Try selection-based matches first (have exact lineup info)
  const { data: selectionMatches } = teamId
    ? await supabase
        .from('match_player_selections')
        .select(
          'is_starting, is_captain, shirt_number, match:matches!inner (id, status, utc_date, home_score, away_score, home_team:teams!matches_home_team_id_fkey (name, tla, crest_url), away_team:teams!matches_away_team_id_fkey (name, tla, crest_url))',
        )
        .eq('player_id', id)
        .gte('matches.utc_date', thirtyDaysAgo)
        .lte('matches.utc_date', sevenDaysAhead)
        .order('matches.utc_date', { ascending: false })
        .limit(10)
    : { data: [] };

  // Fallback: query team matches directly (no lineup data needed)
  const { data: teamMatches } =
    (selectionMatches ?? []).length === 0 && teamId
      ? await supabase
          .from('matches')
          .select(
            'id, status, utc_date, home_score, away_score, home_team:teams!matches_home_team_id_fkey (name, tla, crest_url), away_team:teams!matches_away_team_id_fkey (name, tla, crest_url)',
          )
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .gte('utc_date', thirtyDaysAgo)
          .lte('utc_date', sevenDaysAhead)
          .order('utc_date', { ascending: false })
          .limit(10)
      : { data: [] };

  const recentMatches =
    (selectionMatches ?? []).length > 0
      ? (selectionMatches ?? [])
          .filter((s) => s.match !== null)
          .map((s) => ({ is_starting: s.is_starting, is_captain: s.is_captain, shirt_number: s.shirt_number, match: s.match }))
      : (teamMatches ?? []).map((m) => ({ is_starting: false, is_captain: false, shirt_number: null, match: m }));

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
    recentMatches,
    events: events ?? [],
  };
}
