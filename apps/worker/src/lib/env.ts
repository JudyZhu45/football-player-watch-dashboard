function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export function getWorkerEnv() {
  return {
    supabaseUrl: requireEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    footballDataApiKey: requireEnv("FOOTBALL_DATA_API_KEY"),
    pollCompetitionCodes: requireEnv("POLL_COMPETITION_CODES").split(","),
    liveIntervalMs: Number(process.env.POLL_INTERVAL_LIVE_MS ?? "60000"),
    scheduledIntervalMs: Number(process.env.POLL_INTERVAL_SCHEDULED_MS ?? "900000")
  };
}

