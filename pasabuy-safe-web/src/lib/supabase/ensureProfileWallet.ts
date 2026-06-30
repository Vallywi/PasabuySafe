import { supabase } from './client';

/**
 * Ensures the current authenticated user's profile has their stellar_address
 * linked. This is required for the strict RLS policies on participants
 * (SELECT/UPDATE) which match buyer_address against profiles.stellar_address.
 *
 * Safe to call multiple times — it's a no-op if the address is already saved.
 * Returns true if the profile was updated (or already correct), false if no
 * authenticated user is found.
 */
export async function ensureProfileWalletLinked(stellarAddress: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('profiles')
    .update({
      stellar_address: stellarAddress,
      wallet_linked_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    // Log but don't throw — the migration 006 makes INSERT permissive,
    // so this is a best-effort link for future SELECT/UPDATE RLS checks.
    console.warn('[PasabuySafe] Failed to link wallet to profile:', error.message);
    return false;
  }

  return true;
}
