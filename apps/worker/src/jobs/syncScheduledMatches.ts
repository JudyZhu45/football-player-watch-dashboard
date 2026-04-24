import { fetchCompetitionMatches, fetchMatchDetail, FDCompetition, FDMatch, FDTeamRef } from '../lib/footballDataClient';
import { logger } from '../lib/logger';
import { createSupabaseAdmin } from '../lib/supabaseAdmin';
import { getWorkerEnv } from '../lib/env';

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function syncScheduledMatches(): Promise<void> {
  const startedAt = new Date().toISOString();
  const supabase = createSupabaseAdmin();
  const { pollCompetitionCodes } = getWorkerEnv();

  const now = new Date();
  const dateFrom = toDateStr(new Date(now.getTime() - 14 * 86_400_000)); // 14 days ago
  const dateTo = toDateStr(new Date(now.getTime() + 7 * 86_400_000));    // 7 days ahead

  let requestCount = 0;
  let rowCount = 0;
  let errorMessage: string | null = null;

  try {
    // ── 1. Fetch all competitions' matches ───────────────────────────────────
    const fetched: { competition: FDCompetition; matches: FDMatch[] }[] = [];
    for (const code of pollCompetitionCodes) {
      logger.info(`syncScheduledMatches: fetching ${code} ${dateFrom}→${dateTo}`);
      const result = await fetchCompetitionMatches(code, { dateFrom, dateTo });
      fetched.push(result);
      requestCount++;
    }

    // ── 2. Collect + bulk upsert competitions ────────────────────────────────
    const compMap = new Map<number, FDCompetition>();
    for (const { competition } of fetched) compMap.set(competition.id, competition);

    await supabase.from('competitions').upsert(
      Array.from(compMap.values()).map((c) => ({
        external_id: c.id,
        name: c.name,
        code: c.code ?? null,
        type: c.type ?? null,
        emblem_url: c.emblem ?? null,
        area_name: c.area?.name ?? null,
        is_active: true,
      })),
      { onConflict: 'external_id' },
    );

    const { data: compDbRows } = await supabase
      .from('competitions')
      .select('id, external_id')
      .in('external_id', Array.from(compMap.keys()));
    const compUuidMap = new Map(
      (compDbRows ?? []).map((r) => [r.external_id as number, r.id as string]),
    );

    // ── 3. Collect + bulk upsert teams ───────────────────────────────────────
    const teamMap = new Map<number, FDTeamRef>();
    for (const { matches } of fetched) {
      for (const m of matches) {
        if (m.homeTeam?.id) teamMap.set(m.homeTeam.id, m.homeTeam);
        if (m.awayTeam?.id) teamMap.set(m.awayTeam.id, m.awayTeam);
      }
    }

    await supabase.from('teams').upsert(
      Array.from(teamMap.values()).map((t) => ({
        external_id: t.id,
        name: t.name,
        short_name: t.shortName ?? null,
        tla: t.tla ?? null,
        crest_url: t.crest ?? null,
      })),
      { onConflict: 'external_id' },
    );

    const { data: teamDbRows } = await supabase
      .from('teams')
      .select('id, external_id')
      .in('external_id', Array.from(teamMap.keys()));
    const teamUuidMap = new Map(
      (teamDbRows ?? []).map((r) => [r.external_id as number, r.id as string]),
    );

    // ── 4. Collect player external IDs referenced in events ──────────────────
    const playerExternalIds = new Set<number>();
    for (const { matches } of fetched) {
      for (const m of matches) {
        for (const g of m.goals ?? []) {
          if (g.scorer?.id) playerExternalIds.add(g.scorer.id);
        }
        for (const b of m.bookings ?? []) {
          if (b.player?.id) playerExternalIds.add(b.player.id);
        }
        for (const s of m.substitutions ?? []) {
          if (s.playerOut?.id) playerExternalIds.add(s.playerOut.id);
          if (s.playerIn?.id) playerExternalIds.add(s.playerIn.id);
        }
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

    // ── 5. Bulk upsert matches ───────────────────────────────────────────────
    const matchUpsertRows: Record<string, unknown>[] = [];
    const matchToCompetitionExtId = new Map<number, number>(); // match external_id → comp external_id

    for (const { competition, matches } of fetched) {
      for (const m of matches) {
        const competitionId = compUuidMap.get(competition.id);
        const homeTeamId = m.homeTeam?.id ? teamUuidMap.get(m.homeTeam.id) : undefined;
        const awayTeamId = m.awayTeam?.id ? teamUuidMap.get(m.awayTeam.id) : undefined;
        if (!competitionId || !homeTeamId || !awayTeamId) continue;

        matchToCompetitionExtId.set(m.id, competition.id);
        matchUpsertRows.push({
          external_id: m.id,
          competition_id: competitionId,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          utc_date: m.utcDate,
          status: m.status,
          matchday: m.matchday ?? null,
          stage: m.stage,
          venue: m.venue ?? null,
          home_score: m.score.fullTime.home ?? 0,
          away_score: m.score.fullTime.away ?? 0,
          winner: m.score.winner ?? null,
          last_polled_at: now.toISOString(),
        });
      }
    }

    if (matchUpsertRows.length > 0) {
      const { error: matchErr } = await supabase
        .from('matches')
        .upsert(matchUpsertRows, { onConflict: 'external_id' });
      if (matchErr) throw new Error(`match upsert: ${matchErr.message}`);
      rowCount += matchUpsertRows.length;
    }

    // ── 6. Query match UUIDs ─────────────────────────────────────────────────
    const matchExternalIds = matchUpsertRows.map((r) => r.external_id as number);
    const { data: matchDbRows } = await supabase
      .from('matches')
      .select('id, external_id')
      .in('external_id', matchExternalIds);
    const matchUuidMap = new Map(
      (matchDbRows ?? []).map((r) => [r.external_id as number, r.id as string]),
    );

    // ── 7. Bulk upsert match events (goals, bookings, subs) ──────────────────
    const eventRows: Record<string, unknown>[] = [];

    for (const { matches } of fetched) {
      for (const m of matches) {
        const matchId = matchUuidMap.get(m.id);
        if (!matchId) continue;

        for (const [i, goal] of (m.goals ?? []).entries()) {
          eventRows.push({
            match_id: matchId,
            player_id: goal.scorer?.id ? (playerUuidMap.get(goal.scorer.id) ?? null) : null,
            team_id: goal.team?.id ? (teamUuidMap.get(goal.team.id) ?? null) : null,
            event_type: 'GOAL',
            minute: goal.minute ?? null,
            external_event_key: `${m.id}_goal_${i}`,
            payload: goal,
          });
        }

        for (const [i, booking] of (m.bookings ?? []).entries()) {
          eventRows.push({
            match_id: matchId,
            player_id: booking.player?.id ? (playerUuidMap.get(booking.player.id) ?? null) : null,
            team_id: booking.team?.id ? (teamUuidMap.get(booking.team.id) ?? null) : null,
            event_type: booking.card,
            minute: booking.minute ?? null,
            external_event_key: `${m.id}_booking_${i}`,
            payload: booking,
          });
        }

        for (const [i, sub] of (m.substitutions ?? []).entries()) {
          eventRows.push({
            match_id: matchId,
            player_id: sub.playerOut?.id ? (playerUuidMap.get(sub.playerOut.id) ?? null) : null,
            team_id: sub.team?.id ? (teamUuidMap.get(sub.team.id) ?? null) : null,
            event_type: 'SUBSTITUTION',
            minute: sub.minute ?? null,
            external_event_key: `${m.id}_sub_${i}`,
            payload: sub,
          });
        }
      }
    }

    // ── 8. For recently FINISHED matches with no events, fetch individual detail ─
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const matchesWithNoEvents = new Set(matchUuidMap.keys());
    for (const row of eventRows) {
      // Remove match external IDs that already have events
      for (const [extId, uuid] of matchUuidMap) {
        if (uuid === row.match_id) matchesWithNoEvents.delete(extId);
      }
    }

    const finishedNoEvents = Array.from(fetched)
      .flatMap(({ matches }) => matches)
      .filter(
        (m) =>
          m.status === 'FINISHED' &&
          matchesWithNoEvents.has(m.id) &&
          m.utcDate >= sevenDaysAgo,
      )
      .slice(0, 10); // cap at 10 detail calls per cycle

    for (const [idx, m] of finishedNoEvents.entries()) {
      try {
        const detail = await fetchMatchDetail(m.id);
        requestCount++;
        if (idx === 0) {
          const raw = detail as unknown as Record<string, unknown>;
          logger.info(`match detail keys: ${Object.keys(raw).join(', ')}`);
          logger.info(`match detail sample`, {
            id: detail.id, status: detail.status,
            goals: detail.goals?.length ?? 'undefined',
            bookings: detail.bookings?.length ?? 'undefined',
            subs: detail.substitutions?.length ?? 'undefined',
            hasMatch: 'match' in raw,
          });
        }
        const matchId = matchUuidMap.get(m.id);
        if (!matchId) continue;

        const detailEvents: Record<string, unknown>[] = [];
        for (const [i, goal] of (detail.goals ?? []).entries()) {
          detailEvents.push({
            match_id: matchId,
            player_id: goal.scorer?.id ? (playerUuidMap.get(goal.scorer.id) ?? null) : null,
            team_id: goal.team?.id ? (teamUuidMap.get(goal.team.id) ?? null) : null,
            event_type: 'GOAL',
            minute: goal.minute ?? null,
            external_event_key: `${m.id}_goal_${i}`,
            payload: goal,
          });
        }
        for (const [i, booking] of (detail.bookings ?? []).entries()) {
          detailEvents.push({
            match_id: matchId,
            player_id: booking.player?.id ? (playerUuidMap.get(booking.player.id) ?? null) : null,
            team_id: booking.team?.id ? (teamUuidMap.get(booking.team.id) ?? null) : null,
            event_type: booking.card,
            minute: booking.minute ?? null,
            external_event_key: `${m.id}_booking_${i}`,
            payload: booking,
          });
        }
        for (const [i, sub] of (detail.substitutions ?? []).entries()) {
          detailEvents.push({
            match_id: matchId,
            player_id: sub.playerOut?.id ? (playerUuidMap.get(sub.playerOut.id) ?? null) : null,
            team_id: sub.team?.id ? (teamUuidMap.get(sub.team.id) ?? null) : null,
            event_type: 'SUBSTITUTION',
            minute: sub.minute ?? null,
            external_event_key: `${m.id}_sub_${i}`,
            payload: sub,
          });
        }
        if (detailEvents.length > 0) eventRows.push(...detailEvents);
      } catch (err) {
        logger.error(`fetchMatchDetail(${m.id}) failed`, err);
      }
    }

    if (eventRows.length > 0) {
      const { error: eventErr } = await supabase
        .from('match_events')
        .upsert(eventRows, { onConflict: 'external_event_key' });
      if (eventErr) throw new Error(`event upsert: ${eventErr.message}`);
      rowCount += eventRows.length;
    }

    logger.info(`syncScheduledMatches: ${matchUpsertRows.length} matches, ${eventRows.length} events (${finishedNoEvents.length} detail fetches)`);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('syncScheduledMatches failed', errorMessage);
  }

  await supabase.from('ingestion_runs').insert({
    job_name: 'sync_scheduled_matches',
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status: errorMessage ? 'error' : 'success',
    request_count: requestCount,
    row_count: rowCount,
    error_message: errorMessage,
    metadata: { dateFrom, dateTo, codes: pollCompetitionCodes },
  });
}
