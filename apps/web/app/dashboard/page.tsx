import Link from 'next/link';

import { getDashboardData } from '@/lib/queries/dashboard';
import { RealtimeRefresher } from '@/components/dashboard/live-dashboard';
import { PlayerWatchCard } from '@/components/dashboard/player-watch-card';

export default async function DashboardPage() {
  const data = await getDashboardData();
  const watchedPlayers = data?.watchedPlayers ?? [];

  const liveCount = watchedPlayers.filter(
    (p) =>
      p.match &&
      (p.match.status === 'IN_PLAY' ||
        p.match.status === 'LIVE' ||
        p.match.status === 'PAUSED'),
  ).length;

  return (
    <>
      <RealtimeRefresher />

      <div className="space-y-8">
        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs text-[var(--muted)]">Watched Players</p>
            <p className="mt-1 text-3xl font-semibold">{watchedPlayers.length}</p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs text-[var(--muted)]">Live Now</p>
            <p className={`mt-1 text-3xl font-semibold ${liveCount > 0 ? 'text-green-700' : ''}`}>
              {liveCount}
            </p>
          </div>
          <div className="col-span-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm sm:col-span-1">
            <p className="text-xs text-[var(--muted)]">Realtime</p>
            <p className="mt-1 text-sm font-semibold text-green-700">Connected ●</p>
          </div>
        </div>

        {/* Player cards */}
        {watchedPlayers.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)] px-8 py-12 text-center">
            <p className="text-lg font-semibold">No players watched yet</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Go to{' '}
              <Link
                href="/settings"
                className="font-semibold text-[var(--accent)] underline underline-offset-2"
              >
                Settings
              </Link>{' '}
              to search for and follow your favorite players.
            </p>
          </section>
        ) : (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
              Your Players
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {watchedPlayers.map((player) => (
                <PlayerWatchCard key={player.id} player={player} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
