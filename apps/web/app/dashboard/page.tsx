import { redirect } from "next/navigation";

import { LiveDashboard } from "@/components/dashboard/live-dashboard";
import { getDashboardData } from "@/lib/queries/dashboard";

export default async function DashboardPage() {
  const { user, profile, favoritePlayers, liveMatches } =
    await getDashboardData();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm text-[var(--muted)]">Welcome back</p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {profile?.display_name ?? profile?.username ?? user.email}
        </h1>
        <p className="max-w-2xl text-[var(--muted)]">
          Your dashboard will fill with favorited players, tracked matches, and
          Realtime updates from the worker.
        </p>
      </section>
      <LiveDashboard
        initialFavoriteCount={favoritePlayers.length}
        initialMatchCount={liveMatches.length}
      />
    </div>
  );
}

