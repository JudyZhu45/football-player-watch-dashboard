'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { createClient } from '@/lib/supabase/browser';
import { subscribeToMatchTables } from '@/lib/realtime/subscriptions';

export function RealtimeRefresher() {
  const router = useRouter();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const client = createClient();
    const unsub = subscribeToMatchTables(client, () => {
      if (mountedRef.current) router.refresh();
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [router]);

  return null;
}
