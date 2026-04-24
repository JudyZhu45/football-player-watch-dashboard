'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createAdminClient } from '../supabase/admin';
import { getOrCreateProfileId } from './profile';

export async function addFavoritePlayer(playerId: string) {
  const profileId = await getOrCreateProfileId();
  if (!profileId) redirect('/sign-in');

  const supabase = createAdminClient();
  await supabase
    .from('user_favorite_players')
    .upsert(
      { user_id: profileId, player_id: playerId },
      { onConflict: 'user_id,player_id', ignoreDuplicates: true },
    );

  revalidatePath('/settings');
  revalidatePath('/dashboard');
}

export async function removeFavoritePlayer(playerId: string) {
  const profileId = await getOrCreateProfileId();
  if (!profileId) redirect('/sign-in');

  const supabase = createAdminClient();
  await supabase
    .from('user_favorite_players')
    .delete()
    .eq('user_id', profileId)
    .eq('player_id', playerId);

  revalidatePath('/settings');
  revalidatePath('/dashboard');
}
