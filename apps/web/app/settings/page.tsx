import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';
import { getOrCreateProfileId } from '@/lib/auth/profile';
import { removeFavoritePlayer } from '@/lib/auth/actions';
import { PlayerSearch } from '@/components/settings/player-search';

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const profileId = await getOrCreateProfileId();
  if (!profileId) redirect('/sign-in');

  const supabase = createAdminClient();

  const { data: favorites } = await supabase
    .from('user_favorite_players')
    .select(
      'player_id, players (id, name, position, team:teams!players_current_team_id_fkey (name, tla, crest_url))',
    )
    .eq('user_id', profileId);

  const favoriteIds = (favorites ?? []).map((f) => f.player_id as string);

  type FavPlayer = {
    id: string;
    name: string;
    position: string | null;
    team: { name: string; tla: string | null; crest_url: string | null } | null;
  };

  const favPlayers = (favorites ?? [])
    .map((f) => f.players as unknown as FavPlayer | null)
    .filter((p): p is FavPlayer => p !== null);

  return (
    <div className="space-y-10">
      <section className="space-y-1">
        <h1 className="text-4xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--muted)]">Manage the players you follow.</p>
      </section>

      {/* Current favorites */}
      <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
          Following ({favPlayers.length})
        </h2>

        {favPlayers.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            You&apos;re not following anyone yet. Search below to add players.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--panel-border)]">
            {favPlayers.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                {p.team?.crest_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.team.crest_url} alt="" className="h-6 w-6 object-contain" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {[p.position, p.team?.name].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <form
                  action={async () => {
                    'use server';
                    await removeFavoritePlayer(p.id);
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Unfollow
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Player search */}
      <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
          Find Players
        </h2>
        <PlayerSearch favoriteIds={favoriteIds} />
      </section>
    </div>
  );
}
