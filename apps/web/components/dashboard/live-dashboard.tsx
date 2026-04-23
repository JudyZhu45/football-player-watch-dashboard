"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/browser";
import { subscribeToMatchTables } from "@/lib/realtime/subscriptions";

type LiveDashboardProps = {
  initialMatchCount: number;
  initialFavoriteCount: number;
};

export function LiveDashboard({
  initialMatchCount,
  initialFavoriteCount
}: LiveDashboardProps) {
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    const client = createClient();
    return subscribeToMatchTables(client, () => {
      setRefreshCount((count) => count + 1);
    });
  }, []);

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm backdrop-blur">
        <p className="text-sm text-[var(--muted)]">Watched Players</p>
        <p className="mt-2 text-4xl font-semibold">{initialFavoriteCount}</p>
      </div>
      <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm backdrop-blur">
        <p className="text-sm text-[var(--muted)]">Tracked Matches</p>
        <p className="mt-2 text-4xl font-semibold">{initialMatchCount}</p>
      </div>
      <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm backdrop-blur">
        <p className="text-sm text-[var(--muted)]">Realtime Changes Seen</p>
        <p className="mt-2 text-4xl font-semibold">{refreshCount}</p>
      </div>
    </section>
  );
}

