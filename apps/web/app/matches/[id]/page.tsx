import { notFound } from 'next/navigation';

import { getMatchDetail } from '@/lib/queries/matches';
import { StatusBadge } from '@/components/ui/status-badge';
import { LiveMatchRefresher } from '@/components/match/live-match';

type Props = { params: Promise<{ id: string }> };

const EVENT_ICON: Record<string, string> = {
  GOAL: '⚽',
  YELLOW: '🟨',
  RED: '🟥',
  YELLOW_RED: '🟧',
  SUBSTITUTION: '🔄',
};

const LIVE_STATUSES = new Set(['IN_PLAY', 'LIVE', 'PAUSED']);

export default async function MatchPage({ params }: Props) {
  const { id } = await params;

  const data = await getMatchDetail(id);
  if (!data) notFound();

  const { match, events, selections } = data;

  type MatchData = typeof match & {
    competition: { name: string; code: string | null; emblem_url: string | null } | null;
    home_team: { id: string; name: string; tla: string | null; crest_url: string | null };
    away_team: { id: string; name: string; tla: string | null; crest_url: string | null };
  };
  const m = match as unknown as MatchData;
  const isLive = LIVE_STATUSES.has(m.status);

  type SelTeam = { id: string } | null;
  const homeLineup = selections.filter(
    (s) => (s.team as unknown as SelTeam)?.id === m.home_team.id && s.is_starting,
  );
  const awayLineup = selections.filter(
    (s) => (s.team as unknown as SelTeam)?.id === m.away_team.id && s.is_starting,
  );
  const homeBench = selections.filter(
    (s) => (s.team as unknown as SelTeam)?.id === m.home_team.id && !s.is_starting,
  );
  const awayBench = selections.filter(
    (s) => (s.team as unknown as SelTeam)?.id === m.away_team.id && !s.is_starting,
  );

  return (
    <div className="space-y-6">
      {isLive && <LiveMatchRefresher matchId={id} />}

      {/* Match header */}
      <section className={`rounded-[2rem] border p-6 shadow-sm ${isLive ? 'border-green-300 bg-green-50/80' : 'border-[var(--panel-border)] bg-[var(--panel)]'}`}>
        {m.competition && (
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            {m.competition.name}
            {m.matchday ? ` · Matchday ${m.matchday}` : ''}
          </p>
        )}

        <div className="flex items-center justify-between gap-4">
          {/* Home team */}
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            {m.home_team.crest_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.home_team.crest_url} alt="" className="h-16 w-16 object-contain" />
            )}
            <span className="text-center text-sm font-semibold">{m.home_team.name}</span>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center gap-2 px-4">
            <span className="text-5xl font-bold tabular-nums tracking-tight">
              {m.home_score}
              <span className="mx-2 text-[var(--muted)]">–</span>
              {m.away_score}
            </span>
            <StatusBadge status={m.status} />
            {!isLive && (
              <span className="text-xs text-[var(--muted)]">
                {new Date(m.utc_date).toLocaleDateString(undefined, {
                  weekday: 'short', month: 'short', day: 'numeric',
                })}
              </span>
            )}
          </div>

          {/* Away team */}
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            {m.away_team.crest_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.away_team.crest_url} alt="" className="h-16 w-16 object-contain" />
            )}
            <span className="text-center text-sm font-semibold">{m.away_team.name}</span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* Event timeline */}
        <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
            Timeline {isLive && <span className="ml-1 text-green-600">· Live</span>}
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No events recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((ev) => {
                type EventRow = typeof ev & {
                  player: { name: string } | null;
                  team: { name: string; tla: string | null } | null;
                };
                const e = ev as EventRow;
                return (
                  <li key={e.id} className="flex items-start gap-3 text-sm">
                    <span className="w-8 shrink-0 text-right text-xs font-semibold text-[var(--muted)]">
                      {e.minute !== null ? `${e.minute}'` : '—'}
                    </span>
                    <span className="text-base">{EVENT_ICON[e.event_type] ?? '•'}</span>
                    <div className="min-w-0 flex-1">
                      {e.player && (
                        <span className="font-medium">{e.player.name}</span>
                      )}
                      {e.team && (
                        <span className="ml-1 text-xs text-[var(--muted)]">
                          ({e.team.tla ?? e.team.name})
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Lineups */}
        {(homeLineup.length > 0 || awayLineup.length > 0) && (
          <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
              Lineups
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {/* Home */}
              <div>
                <p className="mb-2 font-semibold">{m.home_team.tla ?? m.home_team.name}</p>
                <ul className="space-y-1">
                  {homeLineup.map((sel, i) => {
                    const player = sel.player as unknown as { id: string; name: string; position: string | null } | null;
                    return (
                      <li key={i} className="flex items-center gap-2">
                        {sel.shirt_number && (
                          <span className="w-5 shrink-0 text-right text-xs text-[var(--muted)]">{sel.shirt_number}</span>
                        )}
                        <span className="truncate">{player?.name ?? '—'}</span>
                      </li>
                    );
                  })}
                </ul>
                {homeBench.length > 0 && (
                  <>
                    <p className="mt-3 mb-1 text-xs font-semibold uppercase text-[var(--muted)]">Bench</p>
                    <ul className="space-y-1">
                      {homeBench.map((sel, i) => {
                        const player = sel.player as unknown as { id: string; name: string } | null;
                        return (
                          <li key={i} className="flex items-center gap-2 text-[var(--muted)]">
                            {sel.shirt_number && (
                              <span className="w-5 shrink-0 text-right text-xs">{sel.shirt_number}</span>
                            )}
                            <span className="truncate text-xs">{player?.name ?? '—'}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>

              {/* Away */}
              <div>
                <p className="mb-2 font-semibold">{m.away_team.tla ?? m.away_team.name}</p>
                <ul className="space-y-1">
                  {awayLineup.map((sel, i) => {
                    const player = sel.player as unknown as { id: string; name: string; position: string | null } | null;
                    return (
                      <li key={i} className="flex items-center gap-2">
                        {sel.shirt_number && (
                          <span className="w-5 shrink-0 text-right text-xs text-[var(--muted)]">{sel.shirt_number}</span>
                        )}
                        <span className="truncate">{player?.name ?? '—'}</span>
                      </li>
                    );
                  })}
                </ul>
                {awayBench.length > 0 && (
                  <>
                    <p className="mt-3 mb-1 text-xs font-semibold uppercase text-[var(--muted)]">Bench</p>
                    <ul className="space-y-1">
                      {awayBench.map((sel, i) => {
                        const player = sel.player as unknown as { id: string; name: string } | null;
                        return (
                          <li key={i} className="flex items-center gap-2 text-[var(--muted)]">
                            {sel.shirt_number && (
                              <span className="w-5 shrink-0 text-right text-xs">{sel.shirt_number}</span>
                            )}
                            <span className="truncate text-xs">{player?.name ?? '—'}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
