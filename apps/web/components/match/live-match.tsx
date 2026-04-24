'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { createClient } from '@/lib/supabase/browser';

export function LiveMatchRefresher({ matchId }: { matchId: string }) {
  const router = useRouter();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const client = createClient();

    const channel = client
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        () => { if (mountedRef.current) router.refresh(); },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` },
        () => { if (mountedRef.current) router.refresh(); },
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      void client.removeChannel(channel);
    };
  }, [matchId, router]);

  return null;
}
