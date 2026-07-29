// 認証・課金チェック用の共有ヘルパー。api/配下の直下ファイルではなく _lib/ に置くことで、
// Vercelのルーティング対象（各ファイル=エンドポイント）から除外している。

const SUPABASE_URL = 'https://ohmlqpmxgsqyrwepvleo.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obWxxcG14Z3NxeXJ3ZXB2bGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzMzMTQsImV4cCI6MjA5NzcwOTMxNH0.SuYdVdaGmfppFYvQAIRdIShVXf4L4LTFsk2ocQVp90A'

/** AI機能はサインアップから何日間無料か。lib/entitlements.ts（クライアント側）と値を揃えること。 */
const AI_TRIAL_DAYS = 30

/**
 * リクエストのAuthorizationヘッダーからSupabaseユーザーを検証し、
 * トライアル中または購読中であればokを返す。それ以外は402扱いにする。
 */
export async function checkAiEntitlement(req) {
  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { ok: false, status: 401, error: 'missing_token' }

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  })
  if (!userRes.ok) return { ok: false, status: 401, error: 'invalid_token' }
  const user = await userRes.json()
  const userId = user?.id
  if (!userId) return { ok: false, status: 401, error: 'invalid_token' }

  // ユーザー自身のアクセストークンでPostgRESTに問い合わせる（RLSにより本人の行だけ読める）。
  const headers = { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY }
  const [appUserRes, subRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/app_user?user_id=eq.${userId}&select=created_at`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/subscription?user_id=eq.${userId}&select=status,expires_at`, { headers }),
  ])
  const appUserRows = appUserRes.ok ? await appUserRes.json() : []
  const subRows = subRes.ok ? await subRes.json() : []

  const createdAt = appUserRows[0]?.created_at ? new Date(appUserRows[0].created_at) : new Date()
  const daysSinceSignup = Math.floor((Date.now() - createdAt.getTime()) / 86400000)
  const trialActive = daysSinceSignup < AI_TRIAL_DAYS

  const sub = subRows[0]
  const subscribed =
    !!sub &&
    (sub.status === 'active' || sub.status === 'trialing') &&
    (!sub.expires_at || new Date(sub.expires_at) > new Date())

  if (!trialActive && !subscribed) return { ok: false, status: 402, error: 'subscription_required' }
  return { ok: true, userId }
}
