import { authedPost } from './apiClient'
import { supabase } from './supabase'
import { VERCEL_BASE } from './strava'

/** アカウントと関連データを完全に削除し、ログアウトする。 */
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await authedPost(`${VERCEL_BASE}/api/delete-account`, {})
    if (!r.ok) {
      const data = await r.json().catch(() => ({}))
      return { ok: false, error: data.error || `status ${r.status}` }
    }
    await supabase.auth.signOut()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network_error' }
  }
}
