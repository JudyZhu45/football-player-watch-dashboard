import Link from 'next/link';

import type { WatchedPlayer } from '@/lib/queries/dashboard';
import { StatusBadge } from '@/components/ui/status-badge';

function formatKickoff(utcDate: string) {
  return new Date(utcDate).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PlayerWatchCard({ player }: { player: WatchedPlayer }) {
  const { match } = player;
  const isLive = match && (match.status === 'IN_PLAY' || match.status === 'LIVE' || match.status === 'PAUSED');

  return (
    <Link
      href={`/players/${player.id}`}
      className={`group flex flex-col gap-4 rounded-3xl border p-5 shadow-sm backdrop-blur transition hover:shadow-md ${
        isLive
          ? 'border-green-300 bg-green-50/80'
          : 'border-[var(--panel-border)] bg-[var(--panel)]'
      }`}
    >
      {/* Player header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight text-[var(--foreground)] group-hover:text-[var(--accent)]">
            {player.name}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {[player.position, player.nationality].filter(Boolean).join(' · ')}
          </p>
        </div>
        {player.team && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--panel-border)] bg-white/60 px-2.5 py-1">
            {player.team.crest_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.team.crest_url} alt="" className="h-4 w-4 object-contain" />
            )}
            <span className="text-xs font-semibold text-[var(--foreground)]">
              {player.team.tla ?? player.team.name}
            </span>
          </div>
        )}
      </div>

      {/* Match context */}
      {match ? (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-white/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <StatusBadge status={match.status} />
            {!isLive && (
              <span className="text-xs text-[var(--muted)]">{formatKickoff(match.utc_date)}</span>
            )}
            {match.is_starting && (
              <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-semibold text-white">
                XI
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-medium">{match.home_team.tla ?? match.home_team.name}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {match.home_score}
              <span className="mx-1 text-[var(--muted)]">–</span>
              {match.away_score}
            </span>
            <span className="min-w-0 truncate text-right font-medium">{match.away_team.tla ?? match.away_team.name}</span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-white/30 p-3 text-center">
          <span className="text-xs text-[var(--muted)]">No upcoming match</span>
        </div>
      )}
    </Link>
  );
}
