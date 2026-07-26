import { supabase } from '../client'

/** Ensures a `public.users` profile row exists for the given auth user. */
export async function ensureUserProfile(userId: string): Promise<void> {
  const { error } = await supabase.from('users').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw error
}
