'use client';

import { useCallback, useState, useTransition } from 'react';

import { addFavoritePlayer, removeFavoritePlayer } from '@/lib/auth/actions';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';

type PlayerResult = {
  id: string;
  name: string;
  position: string | null;
  team: { name: string; tla: string | null } | null;
};

type Props = {
  favoriteIds: string[];
};

export function PlayerSearch({ favoriteIds }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [favorites, setFavorites] = useState(new Set(favoriteIds));
  const [pending, startTransition] = useTransition();

  const search = useCallback(async (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const client = createClient();
    const { data } = await client
      .from('players')
      .select('id, name, position, team:teams!players_current_team_id_fkey (name, tla)')
      .ilike('name', `%${value.trim()}%`)
      .limit(12);
    setResults((data ?? []) as unknown as PlayerResult[]);
    setSearching(false);
  }, []);

  function toggle(playerId: string) {
    startTransition(async () => {
      if (favorites.has(playerId)) {
        await removeFavoritePlayer(playerId);
        setFavorites((prev) => { const next = new Set(prev); next.delete(playerId); return next; });
      } else {
        await addFavoritePlayer(playerId);
        setFavorites((prev) => new Set([...prev, playerId]));
      }
    });
  }

  return (
    <div className="space-y-4">
      <input
        className="w-full rounded-2xl border border-[var(--panel-border)] bg-white/70 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        placeholder="Search for a player (e.g. Salah, Haaland…)"
        value={query}
        onChange={(e) => void search(e.target.value)}
      />

      {searching && (
        <p className="text-sm text-[var(--muted)]">Searching…</p>
      )}

      {results.length > 0 && (
        <ul className="divide-y divide-[var(--panel-border)] rounded-2xl border border-[var(--panel-border)] bg-white/60">
          {results.map((p) => {
            const isFav = favorites.has(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {[p.position, p.team?.name].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button
                  onClick={() => toggle(p.id)}
                  disabled={pending}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    isFav
                      ? 'bg-green-100 text-green-800 hover:bg-red-100 hover:text-red-700'
                      : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]'
                  }`}
                >
                  {isFav ? 'Following ✓' : '+ Follow'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
