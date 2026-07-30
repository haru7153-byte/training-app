import { Platform } from 'react-native'
import type { PurchasesPackage, PurchasesOffering } from 'react-native-purchases'

/**
 * RevenueCatダッシュボード（https://app.revenuecat.com/）で作成したプロジェクトの
 * Public SDK Key（Apple App Store用）に置き換えること。未設定の間、購読機能は無効化される。
 */
const REVENUECAT_IOS_API_KEY = 'appl_iCaZfLenhbJFLVeWpphFiFfztwp'

let configured = false

// react-native-purchasesは、importされた時点でネイティブモジュールを読み込もうとする。
// まだそれが組み込まれていないビルド（次のEASビルド待ち）でアプリ全体が起動時に
// クラッシュしないよう、静的importではなく遅延requireにしてtry/catchで囲む。
let cachedModule: any = undefined

function getPurchases(): any {
  if (cachedModule !== undefined) return cachedModule
  try {
    cachedModule = require('react-native-purchases').default
  } catch {
    cachedModule = null
  }
  return cachedModule
}

export function isPurchasesConfigured(): boolean {
  return REVENUECAT_IOS_API_KEY.length > 0
}

/** ログイン確定後に一度呼ぶ。RevenueCat側のappUserIDをSupabaseのuser_idに合わせておくと、Webhookでの紐付けが単純になる。 */
export async function initPurchases(userId: string): Promise<void> {
  if (Platform.OS !== 'ios' || !isPurchasesConfigured() || configured) return
  const Purchases = getPurchases()
  if (!Purchases) return
  try {
    Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY, appUserID: userId })
    configured = true
  } catch {}
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  const Purchases = getPurchases()
  if (!Purchases || !isPurchasesConfigured()) return null
  try {
    const offerings = await Purchases.getOfferings()
    return offerings.current
  } catch {
    return null
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<{ ok: boolean; error?: string }> {
  const Purchases = getPurchases()
  if (!Purchases || !isPurchasesConfigured()) return { ok: false, error: 'not_configured' }
  try {
    await Purchases.purchasePackage(pkg)
    return { ok: true }
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, error: 'cancelled' }
    return { ok: false, error: e?.message || 'purchase_failed' }
  }
}

export async function restorePurchases(): Promise<{ ok: boolean; error?: string }> {
  const Purchases = getPurchases()
  if (!Purchases || !isPurchasesConfigured()) return { ok: false, error: 'not_configured' }
  try {
    await Purchases.restorePurchases()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'restore_failed' }
  }
}
