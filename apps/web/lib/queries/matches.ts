import { createAdminClient } from '../supabase/admin';

export async function getMatchDetail(id: string) {
  const supabase = createAdminClient();

  const { data: match } = await supabase
    .from('matches')
    .select(
      'id, status, utc_date, home_score, away_score, venue, matchday, stage, competition:competitions (name, code, emblem_url), home_team:teams!matches_home_team_id_fkey (id, name, tla, crest_url), away_team:teams!matches_away_team_id_fkey (id, name, tla, crest_url)',
    )
    .eq('id', id)
    .single();

  if (!match) return null;

  const [{ data: events }, { data: selections }] = await Promise.all([
    supabase
      .from('match_events')
      .select(
        'id, event_type, minute, detail, external_event_key, payload, player:players (name), team:teams (name, tla)',
      )
      .eq('match_id', id)
      .order('minute', { ascending: true, nullsFirst: false }),
    supabase
      .from('match_player_selections')
      .select(
        'is_starting, is_captain, shirt_number, player:players (id, name, position), team:teams (id, name, tla)',
      )
      .eq('match_id', id)
      .order('is_starting', { ascending: false }),
  ]);

  return { match, events: events ?? [], selections: selections ?? [] };
}
