import { fetchMatchDetail, FDMatch } from '../lib/footballDataClient';
import { logger } from '../lib/logger';
import { createSupabaseAdmin } from '../lib/supabaseAdmin';

// Statuses that mean the match is happening right now or is about to start
const LIVE_STATUSES = ['IN_PLAY', 'PAUSED', 'LIVE'];

export async function syncLiveMatches(): Promise<void> {
  const startedAt = new Date().toISOString();
  const supabase = createSupabaseAdmin();

  let requestCount = 0;
  let rowCount = 0;
  let errorMessage: string | null = null;

  try {
    // ── 1. Find live matches + matches starting in the next 90 min ───────────
    const now = new Date();
    const ninetyMinAhead = new Date(now.getTime() + 90 * 60_000).toISOString();
    const twoHoursBehind = new Date(now.getTime() - 120 * 60_000).toISOString();

    const { data: liveRows, error: queryErr } = await supabase
      .from('matches')
      .select('id, external_id, status')
      .or(
        `status.in.(${LIVE_STATUSES.join(',')}),` +
        `and(status.in.(TIMED,SCHEDULED),utc_date.gte.${twoHoursBehind},utc_date.lte.${ninetyMinAhead})`,
      );

    if (queryErr) throw new Error(`live query: ${queryErr.message}`);
    if (!liveRows || liveRows.length === 0) {
      logger.info('syncLiveMatches: no live or starting matches');
      return;
    }

    logger.info(`syncLiveMatches: found ${liveRows.length} match(es) to refresh`);

    // ── 2. Fetch full detail for each live match ──────────────────────────────
    for (const row of liveRows) {
      try {
        const match = await fetchMatchDetail(row.external_id as number);
        requestCount++;
        await processSingleMatch(supabase, row.id as string, match);
        rowCount++;
      } catch (err) {
        logger.error(`syncLiveMatches: failed for match ${row.external_id}`, err);
      }
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('syncLiveMatches failed', errorMessage);
  }

  await supabase.from('ingestion_runs').insert({
    job_name: 'sync_live_matches',
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status: errorMessage ? 'error' : 'success',
    request_count: requestCount,
    row_count: rowCount,
    error_message: errorMessage,
  });
}

async function processSingleMatch(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  matchDbId: string,
  match: FDMatch,
): Promise<void> {
  // ── Update match status and score ─────────────────────────────────────────
  await supabase
    .from('matches')
    .update({
      status: match.status,
      home_score: match.score.fullTime.home ?? 0,
      away_score: match.score.fullTime.away ?? 0,
      winner: match.score.winner ?? null,
      last_polled_at: new Date().toISOString(),
    })
    .eq('id', matchDbId);

  // ── Resolve team and player UUIDs ─────────────────────────────────────────
  const teamExternalIds = [match.homeTeam.id, match.awayTeam.id];
  const { data: teamDbRows } = await supabase
    .from('teams')
    .select('id, external_id')
    .in('external_id', teamExternalIds);
  const teamUuidMap = new Map(
    (teamDbRows ?? []).map((r) => [r.external_id as number, r.id as string]),
  );

  // Collect all player external IDs from events and lineups
  const playerExternalIds = new Set<number>();
  for (const g of match.goals ?? []) {
    if (g.scorer?.id) playerExternalIds.add(g.scorer.id);
    if (g.assist?.id) playerExternalIds.add(g.assist.id);
  }
  for (const b of match.bookings ?? []) {
    if (b.player?.id) playerExternalIds.add(b.player.id);
  }
  for (const s of match.substitutions ?? []) {
    if (s.playerOut?.id) playerExternalIds.add(s.playerOut.id);
    if (s.playerIn?.id) playerExternalIds.add(s.playerIn.id);
  }
  for (const lineup of match.lineups ?? []) {
    for (const entry of [...lineup.startXI, ...lineup.bench]) {
      playerExternalIds.add(entry.player.id);
    }
  }

  let playerUuidMap = new Map<number, string>();
  if (playerExternalIds.size > 0) {
    const { data: playerDbRows } = await supabase
      .from('players')
      .select('id, external_id')
      .in('external_id', Array.from(playerExternalIds));
    playerUuidMap = new Map(
      (playerDbRows ?? []).map((r) => [r.external_id as number, r.id as string]),
    );
  }

  // ── Upsert match events ───────────────────────────────────────────────────
  const eventRows: Record<string, unknown>[] = [];

  for (const [i, goal] of (match.goals ?? []).entries()) {
    eventRows.push({
      match_id: matchDbId,
      player_id: goal.scorer?.id ? (playerUuidMap.get(goal.scorer.id) ?? null) : null,
      team_id: goal.team?.id ? (teamUuidMap.get(goal.team.id) ?? null) : null,
      event_type: 'GOAL',
      minute: goal.minute ?? null,
      external_event_key: `${match.id}_goal_${i}`,
      payload: goal,
    });
  }

  for (const [i, booking] of (match.bookings ?? []).entries()) {
    eventRows.push({
      match_id: matchDbId,
      player_id: booking.player?.id ? (playerUuidMap.get(booking.player.id) ?? null) : null,
      team_id: booking.team?.id ? (teamUuidMap.get(booking.team.id) ?? null) : null,
      event_type: booking.card,
      minute: booking.minute ?? null,
      external_event_key: `${match.id}_booking_${i}`,
      payload: booking,
    });
  }

  for (const [i, sub] of (match.substitutions ?? []).entries()) {
    eventRows.push({
      match_id: matchDbId,
      player_id: sub.playerOut?.id ? (playerUuidMap.get(sub.playerOut.id) ?? null) : null,
      team_id: sub.team?.id ? (teamUuidMap.get(sub.team.id) ?? null) : null,
      event_type: 'SUBSTITUTION',
      minute: sub.minute ?? null,
      external_event_key: `${match.id}_sub_${i}`,
      payload: sub,
    });
  }

  if (eventRows.length > 0) {
    await supabase.from('match_events').upsert(eventRows, { onConflict: 'external_event_key' });
  }

  // ── Upsert player selections (lineups) ────────────────────────────────────
  if (match.lineups && match.lineups.length > 0) {
    const selectionRows: Record<string, unknown>[] = [];

    for (const lineup of match.lineups) {
      const teamId = teamUuidMap.get(lineup.team.id);
      if (!teamId) continue;

      for (const entry of lineup.startXI) {
        const playerId = playerUuidMap.get(entry.player.id);
        if (!playerId) continue;
        selectionRows.push({
          match_id: matchDbId,
          player_id: playerId,
          team_id: teamId,
          role: 'player',
          is_starting: true,
          shirt_number: entry.player.shirtNumber ?? null,
        });
      }

      for (const entry of lineup.bench) {
        const playerId = playerUuidMap.get(entry.player.id);
        if (!playerId) continue;
        selectionRows.push({
          match_id: matchDbId,
          player_id: playerId,
          team_id: teamId,
          role: 'player',
          is_starting: false,
          shirt_number: entry.player.shirtNumber ?? null,
        });
      }
    }

    if (selectionRows.length > 0) {
      await supabase
        .from('match_player_selections')
        .upsert(selectionRows, { onConflict: 'match_id,player_id' });
    }
  }

  logger.info(
    `syncLiveMatches: processed match ${match.id} (${match.status}) ` +
    `${match.score.fullTime.home ?? 0}-${match.score.fullTime.away ?? 0}`,
  );
}
