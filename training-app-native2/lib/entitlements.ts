import { supabase } from './supabase'

/** AI機能（プラン生成・Strava週次分析・日次レビュー・詳細分析）は、この日数だけ無料で使える。 */
export const AI_TRIAL_DAYS = 30

export const AI_PAYWALL_MESSAGE = 'AI機能の無料期間が終了しました。目標タブから購読すると引き続き使えます。'

export interface EntitlementInfo {
  hasAiAccess: boolean
  trialActive: boolean
  trialDaysLeft: number
  subscribed: boolean
}

/** サインアップ日を記録するapp_user行がなければ作る（初回ログイン時）。既存行は上書きしない。 */
export async function ensureAppUserRow(userId: string): Promise<void> {
  await supabase.from('app_user').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
}

export async function getEntitlementInfo(): Promise<EntitlementInfo> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user.id
  if (!userId) {
    return { hasAiAccess: false, trialActive: false, trialDaysLeft: 0, subscribed: false }
  }

  const [{ data: appUser }, { data: sub }] = await Promise.all([
    supabase.from('app_user').select('created_at').eq('user_id', userId).maybeSingle(),
    supabase.from('subscription').select('status, expires_at').eq('user_id', userId).maybeSingle(),
  ])

  const subscribed =
    !!sub &&
    (sub.status === 'active' || sub.status === 'trialing') &&
    (!sub.expires_at || new Date(sub.expires_at) > new Date())

  const signupAt = appUser?.created_at ? new Date(appUser.created_at) : new Date()
  const daysSinceSignup = Math.floor((Date.now() - signupAt.getTime()) / 86400000)
  const trialDaysLeft = Math.max(0, AI_TRIAL_DAYS - daysSinceSignup)
  const trialActive = trialDaysLeft > 0

  return { hasAiAccess: trialActive || subscribed, trialActive, trialDaysLeft, subscribed }
}
