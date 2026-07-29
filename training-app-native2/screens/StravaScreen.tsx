import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '../lib/supabase'
import {
  VERCEL_BASE,
  getValidToken,
  loadStravaAuth,
  saveStravaAuth,
  clearStravaAuth,
  fetchActivitiesSince,
  activitiesByLocalDate,
} from '../lib/strava'
import { formatDateOnly } from '../lib/plan'
import { authedPost } from '../lib/apiClient'
import { AI_PAYWALL_MESSAGE } from '../lib/entitlements'
import { C, styles } from '../lib/theme'

export default function StravaScreen({ onFtpUpdate }: { onFtpUpdate: (ftp: number) => void }) {
  const [activities, setActivities] = useState<any[]>([])
  const [athlete, setAthlete] = useState<any>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [fetchError, setFetchError] = useState('')
  const [syncMsg, setSyncMsg] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiError, setAiError] = useState('')

  const CLIENT_ID = '260703'
  const VERCEL_CALLBACK = `${VERCEL_BASE}/api/strava-callback`
  const APP_SCHEME = 'trainingapp://strava-callback'

  useEffect(() => { loadToken() }, [])

  async function loadToken() {
    const { token: saved, athlete: savedAthlete } = await loadStravaAuth()
    setToken(saved)
    setAthlete(savedAthlete)
  }

  useEffect(() => {
    if (token) fetchActivities()
  }, [token])

  async function syncFtpFromStrava(validToken: string) {
    setSyncing(true)
    try {
      const res = await fetch('https://www.strava.com/api/v3/athlete', {
        headers: { Authorization: `Bearer ${validToken}` },
      })
      const data = await res.json()

      if (res.status === 401 || data?.errors) {
        setSyncMsg('❌ 認証が切れています。再ログインしてください。')
        setSyncing(false)
        setTimeout(() => setSyncMsg(''), 4000)
        return
      }

      const stravaFtp = data.ftp
      if (stravaFtp && stravaFtp > 0) {
        const today = new Date().toISOString().split('T')[0]
        await supabase.from('ftp_log').insert({ ftp: stravaFtp, recorded_at: today })
        onFtpUpdate(stravaFtp)
        setSyncMsg(`✅ FTP を Strava から更新: ${stravaFtp}W`)
      } else if (data.ftp === undefined) {
        // profile:read_all スコープがない場合 ftp フィールド自体が存在しない
        setSyncMsg('⚠️ 再ログインが必要です（スコープ更新）')
      } else {
        setSyncMsg('ℹ️ Strava に FTP が未設定です（Strava → 設定 → FTP で入力してください）')
      }
    } catch {
      setSyncMsg('❌ FTP の同期に失敗しました')
    }
    setSyncing(false)
    setTimeout(() => setSyncMsg(''), 4000)
  }

  async function fetchActivities() {
    setLoading(true)
    setFetchError('')
    const validToken = await getValidToken()
    if (!validToken) { setLoading(false); return }
    try {
      const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=10', {
        headers: { Authorization: `Bearer ${validToken}` },
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        setActivities(data)
      } else if (res.status === 401 || data?.errors) {
        // トークン無効 → 再ログインを促す
        await clearStravaAuth()
        setToken(null)
        setAthlete(null)
        setActivities([])
        setFetchError('セッションが切れました。再度ログインしてください。')
      } else {
        setFetchError('活動の取得に失敗しました。')
      }
    } catch {
      setFetchError('ネットワークエラーが発生しました。')
    }
    setLoading(false)
  }

  async function connectStrava() {
    setAuthError('')
    const scope = 'read,activity:read_all,profile:read_all'
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(VERCEL_CALLBACK)}&response_type=code&scope=${scope}`

    try {
      // APP_SCHEME を監視: Vercel が trainingapp:// にリダイレクトしたら閉じる
      const result = await WebBrowser.openAuthSessionAsync(authUrl, APP_SCHEME)

      if (result.type === 'success' && result.url) {
        const params = new URLSearchParams(result.url.split('?')[1])
        const newToken = params.get('strava_token')
        const refreshToken = params.get('refresh_token')
        const expiresAt = params.get('expires_at')
        const athleteParam = params.get('athlete')

        if (newToken) {
          await saveStravaAuth({ token: newToken, refreshToken: refreshToken ?? undefined, expiresAt: expiresAt ?? undefined })
          setToken(newToken)
          syncFtpFromStrava(newToken)
        }
        if (athleteParam) {
          const parsed = JSON.parse(decodeURIComponent(athleteParam))
          await saveStravaAuth({ athlete: parsed })
          setAthlete(parsed)
        }
      } else if (result.type !== 'cancel') {
        setAuthError('認証に失敗しました。もう一度お試しください。')
      }
    } catch {
      setAuthError('認証に失敗しました。もう一度お試しください。')
    }
  }

  async function analyzeWithAI() {
    setAnalyzing(true)
    setAiAnalysis(null)
    setAiError('')
    try {
      const validToken = await getValidToken()
      if (!validToken) { setAnalyzing(false); return }

      // 過去7日分を、活動が無い日＝休息日も含めて丸ごと渡す（実施日だけを見た偏った分析にしない）
      const sevenDaysAgoUnix = Math.floor(Date.now() / 1000) - 7 * 86400
      const weekActivities = await fetchActivitiesSince(sevenDaysAgoUnix, validToken)
      const byDate = activitiesByLocalDate(weekActivities)
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        const dateStr = formatDateOnly(d)
        return { date: dateStr, activities: byDate.get(dateStr) || [] }
      })

      const r = await authedPost(`${VERCEL_BASE}/api/analyze-activities`, { days })
      if (r.status === 402) {
        setAiError(AI_PAYWALL_MESSAGE)
        setAnalyzing(false)
        return
      }
      const data = await r.json()
      if (data && !data.error) setAiAnalysis(data)
    } catch {
      setAiAnalysis(null)
    }
    setAnalyzing(false)
  }

  async function logout() {
    await clearStravaAuth()
    setToken(null)
    setAthlete(null)
    setActivities([])
  }

  const STRAVA = '#FC4C02'

  function actIcon(type: string) {
    if (type === 'VirtualRide') return '⚡'
    if (type?.includes('Ride')) return '🚴'
    if (type?.includes('Run')) return '🏃'
    if (type?.includes('Swim')) return '🏊'
    return '🏅'
  }

  const totalDist = activities.reduce((s, a) => s + a.distance, 0) / 1000
  const totalTime = activities.reduce((s, a) => s + a.moving_time, 0) / 60

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      {!token ? (
        /* ── ログイン画面 ── */
        <View style={{ gap: 16 }}>
          <View style={{ backgroundColor: STRAVA + '18', borderRadius: 20, borderWidth: 1, borderColor: STRAVA + '40', padding: 32, alignItems: 'center' }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: STRAVA, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 36 }}>🚴</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: C.text, marginBottom: 6 }}>Strava 連携</Text>
            <Text style={{ fontSize: 13, color: C.sub, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
              ライドデータを自動取得して{'\n'}トレーニングを最適化します
            </Text>
            <TouchableOpacity
              onPress={connectStrava}
              style={{ backgroundColor: STRAVA, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Text style={{ fontSize: 18 }}>🔗</Text>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Stravaでログイン</Text>
            </TouchableOpacity>
            {authError !== '' && (
              <Text style={{ marginTop: 14, fontSize: 12, color: C.red, textAlign: 'center' }}>{authError}</Text>
            )}
          </View>

          {[
            { icon: '📊', title: '活動データ取得', desc: 'ライド・ランの距離・時間・獲得標高を自動同期' },
            { icon: '⚡', title: 'FTP自動更新',   desc: 'Stravaに登録したFTPをアプリに反映' },
            { icon: '🤖', title: 'AI連携',        desc: 'リアルデータをもとに最適な週間プランを生成' },
          ].map((f, i) => (
            <View key={i} style={[styles.card, { flexDirection: 'row', gap: 14, alignItems: 'center' }]}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: STRAVA + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20 }}>{f.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 2 }}>{f.title}</Text>
                <Text style={{ fontSize: 11, color: C.sub }}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <>
          {/* ── アスリートカード ── */}
          {athlete && (
            <View style={{ backgroundColor: STRAVA + '14', borderRadius: 20, borderWidth: 1, borderColor: STRAVA + '40', padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: STRAVA, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>
                    {athlete.firstname?.[0]}{athlete.lastname?.[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>{athlete.firstname} {athlete.lastname}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} />
                    <Text style={{ fontSize: 11, color: C.green, fontWeight: '600' }}>Strava 連携中</Text>
                  </View>
                </View>
                <View style={{ gap: 6, alignItems: 'flex-end' }}>
                  <TouchableOpacity
                    onPress={async () => { const t = await getValidToken(); if (t) syncFtpFromStrava(t) }}
                    disabled={syncing}
                    style={{ backgroundColor: syncing ? C.surface : STRAVA, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 }}
                  >
                    <Text style={{ fontSize: 11, color: syncing ? C.muted : '#fff', fontWeight: '700' }}>{syncing ? '同期中...' : '⚡ FTP同期'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={logout}>
                    <Text style={{ fontSize: 10, color: C.muted }}>切断</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {syncMsg !== '' && (
                <View style={{ marginTop: 12, backgroundColor: C.surface, borderRadius: 10, padding: 10 }}>
                  <Text style={{ fontSize: 12, color: syncMsg.startsWith('✅') ? C.green : syncMsg.startsWith('⚠️') ? C.orange : C.sub }}>{syncMsg}</Text>
                </View>
              )}
            </View>
          )}

          {/* ── 活動サマリー ── */}
          {activities.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { label: '合計距離',  val: `${totalDist.toFixed(0)} km`,          color: C.blue },
                { label: '合計時間',  val: `${Math.floor(totalTime / 60)}h${Math.round(totalTime % 60)}m`, color: C.cyan },
                { label: '活動数',    val: `${activities.length} 件`,              color: C.purple },
              ].map((s, i) => (
                <View key={i} style={[styles.card, { flex: 1, padding: 12 }]}>
                  <Text style={{ fontSize: 9, color: C.muted, marginBottom: 4 }}>{s.label}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: s.color }}>{s.val}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── AI分析 ── */}
          {activities.length > 0 && (
            <View style={[styles.card, { backgroundColor: '#0F1A2E', borderColor: C.blue + '40' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Text style={{ fontSize: 22 }}>🤖</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>Stravaデータ AI分析</Text>
                  <Text style={{ fontSize: 10, color: C.sub }}>過去7日間（休息日も含む）から疲労・強度バランスを分析</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={analyzeWithAI}
                disabled={analyzing}
                style={{ backgroundColor: analyzing ? C.muted : C.blue, borderRadius: 10, padding: 12, marginBottom: aiAnalysis ? 14 : 0 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
                  {analyzing ? '⏳ 分析中...' : aiAnalysis ? '🔄 再分析する' : '📊 AIで分析する'}
                </Text>
              </TouchableOpacity>
              {aiError !== '' && (
                <Text style={{ fontSize: 12, color: C.orange, marginTop: 10, lineHeight: 16 }}>🔒 {aiError}</Text>
              )}
              {aiAnalysis && typeof aiAnalysis === 'object' && (
                <View style={{ gap: 10 }}>
                  {[
                    { label: '疲労度',           val: (aiAnalysis as any).fatigue,        color: C.red },
                    { label: '強度バランス',     val: (aiAnalysis as any).balance,        color: C.orange },
                    { label: '今週のアドバイス', val: (aiAnalysis as any).recommendation, color: C.cyan },
                    { label: '今日すべきこと',   val: (aiAnalysis as any).todayAdvice,    color: C.green },
                  ].map((item, i) => (
                    <View key={i} style={{ backgroundColor: item.color + '15', borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: item.color }}>
                      <Text style={{ fontSize: 9, color: item.color, fontWeight: '700', marginBottom: 4 }}>{item.label}</Text>
                      <Text style={{ fontSize: 12, color: C.text, lineHeight: 18 }}>{item.val}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── 活動一覧ヘッダー ── */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>最近の活動</Text>
            <TouchableOpacity onPress={fetchActivities} disabled={loading}
              style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 }}>
              <Text style={{ fontSize: 11, color: loading ? C.muted : C.blue, fontWeight: '700' }}>{loading ? '読込中...' : '更新'}</Text>
            </TouchableOpacity>
          </View>

          {fetchError !== '' && (
            <View style={{ backgroundColor: C.red + '18', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.red + '40' }}>
              <Text style={{ fontSize: 12, color: C.red }}>{fetchError}</Text>
            </View>
          )}

          {loading ? (
            <Text style={{ textAlign: 'center', color: C.muted, padding: 32 }}>読み込み中...</Text>
          ) : activities.length === 0 && fetchError === '' ? (
            <Text style={{ textAlign: 'center', color: C.muted, padding: 32 }}>活動データがありません</Text>
          ) : (
            activities.map((act, i) => {
              const km = (act.distance / 1000).toFixed(1)
              const mins = Math.floor(act.moving_time / 60)
              const speedKmh = act.average_speed ? (act.average_speed * 3.6).toFixed(1) : null
              const watts = act.average_watts ? Math.round(act.average_watts) : null
              const date = (() => {
                const [y, m, d] = act.start_date_local.substring(0, 10).split('-').map(Number)
                return new Date(y, m - 1, d)
              })()
              const dateStr = date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })

              return (
                <View key={i} style={[styles.card, { overflow: 'hidden' }]}>
                  {/* 左アクセントライン */}
                  <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: STRAVA, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }} />
                  <View style={{ marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <Text style={{ fontSize: 22 }}>{actIcon(act.type)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 }}>{act.name}</Text>
                        <Text style={{ fontSize: 11, color: C.sub }}>{dateStr}</Text>
                      </View>
                      {watts && (
                        <View style={{ backgroundColor: C.orange + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: C.orange }}>{watts}W</Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 0 }}>
                      {[
                        { label: '距離',   val: `${km} km` },
                        { label: '時間',   val: `${mins}分` },
                        { label: '標高',   val: `${act.total_elevation_gain}m` },
                        ...(speedKmh ? [{ label: '速度', val: `${speedKmh}km/h` }] : []),
                      ].map((s, j) => (
                        <View key={j} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border,
                          ...(j > 0 ? { borderLeftWidth: 1, borderLeftColor: C.border } : {}) }}>
                          <Text style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>{s.label}</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{s.val}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )
            })
          )}

        </>
      )}
    </ScrollView>
  )
}
