"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export function subscribeToMatchTables(
  client: SupabaseClient,
  onChange: () => void
) {
  const channel = client
    .channel("match-live-updates")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "matches" },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "match_events" },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "player_match_stats" },
      onChange
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

