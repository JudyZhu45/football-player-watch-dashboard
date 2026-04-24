import { fetchCompetitionTeams } from '../lib/footballDataClient';
import { logger } from '../lib/logger';
import { createSupabaseAdmin } from '../lib/supabaseAdmin';
import { getWorkerEnv } from '../lib/env';

export async function syncTeamsAndPlayers(): Promise<void> {
  const startedAt = new Date().toISOString();
  const supabase = createSupabaseAdmin();
  const { pollCompetitionCodes } = getWorkerEnv();

  let requestCount = 0;
  let rowCount = 0;
  let errorMessage: string | null = null;

  try {
    for (const code of pollCompetitionCodes) {
      logger.info(`syncTeamsAndPlayers: fetching teams for ${code}`);
      const { teams } = await fetchCompetitionTeams(code);
      requestCount++;

      // Bulk upsert teams
      const teamRows = teams.map((t) => ({
        external_id: t.id,
        name: t.name,
        short_name: t.shortName,
        tla: t.tla,
        crest_url: t.crest,
        venue: t.venue ?? null,
        founded: t.founded ?? null,
        website: t.website ?? null,
      }));

      const { error: teamErr } = await supabase
        .from('teams')
        .upsert(teamRows, { onConflict: 'external_id' });
      if (teamErr) throw new Error(`team upsert (${code}): ${teamErr.message}`);
      rowCount += teamRows.length;

      // Query team UUIDs
      const teamExternalIds = teams.map((t) => t.id);
      const { data: teamDbRows, error: teamQueryErr } = await supabase
        .from('teams')
        .select('id, external_id')
        .in('external_id', teamExternalIds);
      if (teamQueryErr) throw new Error(`team query: ${teamQueryErr.message}`);
      const teamUuidMap = new Map(
        (teamDbRows ?? []).map((r) => [r.external_id as number, r.id as string]),
      );

      // Collect all players from all squads
      const playerRows: {
        external_id: number;
        name: string;
        position: string | null;
        date_of_birth: string | null;
        nationality: string | null;
        shirt_number: number | null;
        current_team_id: string | null;
      }[] = [];

      for (const team of teams) {
        const teamId = teamUuidMap.get(team.id) ?? null;
        for (const player of team.squad ?? []) {
          playerRows.push({
            external_id: player.id,
            name: player.name,
            position: player.position ?? null,
            date_of_birth: player.dateOfBirth ?? null,
            nationality: player.nationality ?? null,
            shirt_number: player.shirtNumber ?? null,
            current_team_id: teamId,
          });
        }
      }

      if (playerRows.length > 0) {
        const { error: playerErr } = await supabase
          .from('players')
          .upsert(playerRows, { onConflict: 'external_id' });
        if (playerErr) throw new Error(`player upsert (${code}): ${playerErr.message}`);
        rowCount += playerRows.length;
      }

      logger.info(`syncTeamsAndPlayers: ${code} → ${teamRows.length} teams, ${playerRows.length} players`);
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('syncTeamsAndPlayers failed', errorMessage);
  }

  await supabase.from('ingestion_runs').insert({
    job_name: 'sync_teams_and_players',
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status: errorMessage ? 'error' : 'success',
    request_count: requestCount,
    row_count: rowCount,
    error_message: errorMessage,
  });
}
