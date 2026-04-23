import { fetchCompetitionMatches } from "../lib/footballDataClient";
import { createSupabaseAdmin } from "../lib/supabaseAdmin";

export async function syncScheduledMatches() {
  const supabase = createSupabaseAdmin();
  const competitionCodes = (process.env.POLL_COMPETITION_CODES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  for (const code of competitionCodes) {
    const payload = await fetchCompetitionMatches(code);

    await supabase.from("ingestion_runs").insert({
      job_name: "sync_scheduled_matches",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      status: "stubbed",
      request_count: 1,
      row_count: Array.isArray(payload.matches) ? payload.matches.length : 0,
      metadata: {
        competitionCode: code
      }
    });
  }
}

