import { config } from 'dotenv';
config({ path: '.env.local' });

import { getWorkerEnv } from './lib/env';
import { logger } from './lib/logger';
import { syncTeamsAndPlayers } from './jobs/syncTeamsAndPlayers';
import { syncScheduledMatches } from './jobs/syncScheduledMatches';
import { syncLiveMatches } from './jobs/syncLiveMatches';

function safeRun(name: string, fn: () => Promise<void>): () => void {
  return () => {
    fn().catch((err: unknown) => logger.error(`${name} unhandled error`, err));
  };
}

async function run(): Promise<void> {
  const env = getWorkerEnv();

  logger.info('worker booting', {
    competitions: env.pollCompetitionCodes,
    liveIntervalMs: env.liveIntervalMs,
    scheduledIntervalMs: env.scheduledIntervalMs,
  });

  // ── Boot sequence (sequential so teams exist before matches are upserted) ──
  logger.info('boot: syncing teams and players');
  await syncTeamsAndPlayers();

  logger.info('boot: syncing scheduled matches');
  await syncScheduledMatches();

  // ── Polling intervals ──────────────────────────────────────────────────────

  // Every 60 sec: refresh live matches
  setInterval(safeRun('syncLiveMatches', syncLiveMatches), env.liveIntervalMs);

  // Every 15 min: refresh scheduled window and events
  setInterval(safeRun('syncScheduledMatches', syncScheduledMatches), env.scheduledIntervalMs);

  // Every 12 hours: refresh team rosters
  const twelveHours = 12 * 60 * 60_000;
  setInterval(safeRun('syncTeamsAndPlayers', syncTeamsAndPlayers), twelveHours);

  logger.info('worker running — intervals started');
}

run().catch((err: unknown) => {
  logger.error('fatal boot error', err);
  process.exit(1);
});
