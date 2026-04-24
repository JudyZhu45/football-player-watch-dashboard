import { auth } from '@clerk/nextjs/server';

import { createAdminClient } from '../supabase/admin';

/**
 * Returns the Supabase profile UUID for the currently signed-in Clerk user.
 * Creates the profile row on first access (lazy init replaces the DB trigger).
 */
export async function getOrCreateProfileId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (existing) return existing.id as string;

  // First sign-in — create the profile row
  const { data: created, error } = await supabase
    .from('profiles')
    .insert({ id: crypto.randomUUID(), clerk_user_id: userId })
    .select('id')
    .single();

  if (error) {
    console.error('getOrCreateProfileId failed:', error.message);
    return null;
  }

  return created.id as string;
}
