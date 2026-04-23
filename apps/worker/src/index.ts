import { getWorkerEnv } from "./lib/env";
import { syncScheduledMatches } from "./jobs/syncScheduledMatches";

async function run() {
  const env = getWorkerEnv();
  console.log("worker booted", {
    competitions: env.pollCompetitionCodes,
    liveIntervalMs: env.liveIntervalMs,
    scheduledIntervalMs: env.scheduledIntervalMs
  });

  await syncScheduledMatches();

  setInterval(() => {
    void syncScheduledMatches().catch((error) => {
      console.error("scheduled sync failed", error);
    });
  }, env.scheduledIntervalMs);
}

void run().catch((error) => {
  console.error("worker failed to start", error);
  process.exit(1);
});

