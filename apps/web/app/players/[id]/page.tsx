import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getPlayerDetail } from '@/lib/queries/players';
import { StatusBadge } from '@/components/ui/status-badge';

type Props = { params: Promise<{ id: string }> };

const EVENT_ICON: Record<string, string> = {
  GOAL: '⚽',
  YELLOW: '🟨',
  RED: '🟥',
  YELLOW_RED: '🟧',
  SUBSTITUTION: '🔄',
};

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;
  const data = await getPlayerDetail(id);
  if (!data) notFound();

  const { player, recentMatches, events } = data;

  type PlayerData = typeof player & {
    team: { id: string; name: string; short_name: string | null; tla: string | null; crest_url: string | null; venue: string | null } | null;
  };
  const p = player as PlayerData;

  return (
    <div className="space-y-8">
      {/* Player header */}
      <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="flex items-start gap-4">
          {p.team?.crest_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.team.crest_url} alt="" className="h-16 w-16 object-contain" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold tracking-tight">{p.name}</h1>
            <div className="mt-1 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
              {p.position && <span>{p.position}</span>}
              {p.nationality && <span>· {p.nationality}</span>}
              {p.shirt_number && <span>· #{p.shirt_number}</span>}
            </div>
            {p.team && (
              <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                {p.team.name}
                {p.team.venue && (
                  <span className="ml-2 font-normal text-[var(--muted)]">· {p.team.venue}</span>
                )}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent matches */}
        <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
            Recent Matches
          </h2>
          {recentMatches.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No recent match data.</p>
          ) : (
            <ul className="space-y-3">
              {recentMatches.map((sel, i) => {
                const m = sel.match as unknown as {
                  id: string; status: string; utc_date: string;
                  home_score: number; away_score: number;
                  home_team: { name: string; tla: string | null };
                  away_team: { name: string; tla: string | null };
                } | null;
                if (!m) return null;
                return (
                  <li key={i}>
                    <Link
                      href={`/matches/${m.id}`}
                      className="flex items-center gap-3 rounded-2xl border border-[var(--panel-border)] bg-white/50 px-4 py-3 hover:border-[var(--accent)] hover:bg-white/80"
                    >
                      <StatusBadge status={m.status} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {m.home_team.tla ?? m.home_team.name} {m.home_score}–{m.away_score} {m.away_team.tla ?? m.away_team.name}
                      </span>
                      {sel.is_starting && (
                        <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-semibold text-white">
                          XI
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Events */}
        <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
            Recent Events
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Events (goals, cards, subs) are recorded during live matches.
            </p>
          ) : (
            <ul className="space-y-2">
              {events.map((ev) => {
                type EventRow = typeof ev & {
                  match: { id: string; utc_date: string; status: string; home_team: { name: string; tla: string | null }; away_team: { name: string; tla: string | null } } | null;
                };
                const e = ev as EventRow;
                return (
                  <li key={e.id} className="flex items-start gap-3 text-sm">
                    <span className="text-base">{EVENT_ICON[e.event_type] ?? '•'}</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{e.event_type.replace('_', ' ')}</span>
                      {e.minute !== null && (
                        <span className="ml-1 text-[var(--muted)]">{e.minute}'</span>
                      )}
                      {e.match && (
                        <span className="ml-2 text-xs text-[var(--muted)]">
                          {e.match.home_team.tla ?? e.match.home_team.name} vs {e.match.away_team.tla ?? e.match.away_team.name}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
