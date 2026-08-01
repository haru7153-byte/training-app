/**
 * Sentryダッシュボード（https://sentry.io/）で作成したプロジェクトのDSNに置き換えること。
 * 未設定の間、クラッシュ監視は無効化される。
 */
const SENTRY_DSN = 'YOUR_SENTRY_DSN'

export function isCrashReportingConfigured(): boolean {
  return SENTRY_DSN.length > 0 && SENTRY_DSN !== 'YOUR_SENTRY_DSN'
}

// @sentry/react-nativeも他のネイティブ依存と同様、静的importではなく遅延requireにして
// try/catchで囲む（まだ組み込まれていないビルドでアプリ全体がクラッシュしないように）。
function getSentry(): any {
  try {
    return require('@sentry/react-native')
  } catch {
    return null
  }
}

/** アプリ起動時（モジュールの先頭）に一度だけ呼ぶ。 */
export function initCrashReporting(): void {
  if (!isCrashReportingConfigured()) return
  const Sentry = getSentry()
  if (!Sentry) return
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: 0.2,
      enableAutoSessionTracking: true,
    })
  } catch {}
}

/** Reactのレンダリングエラーも捕捉できるよう、ルートコンポーネントをラップする。未設定なら素通し。 */
export function wrapWithCrashReporting<T>(component: T): T {
  if (!isCrashReportingConfigured()) return component
  const Sentry = getSentry()
  if (!Sentry) return component
  try {
    return Sentry.wrap(component)
  } catch {
    return component
  }
}

/** try/catchで拾った例外を、握りつぶす代わりに送りたい箇所で使う（任意）。 */
export function reportError(error: unknown, extra?: Record<string, unknown>): void {
  if (!isCrashReportingConfigured()) return
  const Sentry = getSentry()
  if (!Sentry) return
  try {
    Sentry.captureException(error, extra ? { extra } : undefined)
  } catch {}
}
