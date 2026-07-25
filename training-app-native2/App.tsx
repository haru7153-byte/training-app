import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import Svg, { Polyline, Line, Circle, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as WebBrowser from 'expo-web-browser'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { requestAuthorization, getMostRecentQuantitySample, saveQuantitySample } from '@kingstinct/react-native-healthkit'
import {
  VERCEL_BASE,
  getValidToken,
  loadStravaAuth,
  saveStravaAuth,
  clearStravaAuth,
  fetchActivitiesSince,
  activitiesByLocalDate,
  activityWeekdayIndex,
  computeActivityTss,
  StravaActivity,
} from './lib/strava'
import {
  DAYS_JP,
  Phase,
  DayType,
  ReviewStatus,
  TrainingPlanRow,
  PlanWeekRow,
  PlanDayRow,
  DayReviewResult,
  getActivePlan,
  createTrainingPlan,
  getPlanDays,
  saveGeneratedWeekDays,
  updatePlanDayReview,
  classifyDayReview,
  parseDateOnly,
} from './lib/plan'

const C = {
  bg:      '#080C14',
  surface: '#0F1520',
  card:    '#141C2C',
  blue:    '#3B82F6',
  cyan:    '#06B6D4',
  green:   '#10B981',
  orange:  '#F97316',
  red:     '#EF4444',
  purple:  '#8B5CF6',
  text:    '#F1F5F9',
  sub:     '#94A3B8',
  muted:   '#475569',
  border:  '#1E2D45',
}

const TABS = [
  { id: 'home',   label: 'ホーム',  icon: '⚡' },
  { id: 'plan',   label: 'プラン',  icon: '📅' },
  { id: 'strava', label: 'Strava', icon: '🚴' },
  { id: 'weight', label: '体重',    icon: '⚖️' },
  { id: 'goals',  label: '目標',    icon: '🎯' },
]

const PHASE_COLORS: Record<Phase, string> = { Base: C.green, Build: C.orange, Peak: C.red, Taper: C.cyan }

const REVIEW_LABELS: Record<ReviewStatus, { label: string; color: string }> = {
  pending:      { label: '未評価',           color: C.muted },
  completed:    { label: '✅ 達成',           color: C.green },
  partial:      { label: '🟡 部分達成',       color: C.orange },
  not_done:     { label: '❌ 未実施',         color: C.red },
  rest_ok:      { label: '😴 休養OK',         color: C.muted },
  rest_skipped: { label: '⚠️ レスト日に運動', color: C.orange },
}

const ZONE_COLORS: Record<string, string> = {
  Recovery: C.muted,
  Endurance: C.blue,
  Tempo: C.green,
  'Sweet Spot': '#EAB308',
  Threshold: C.orange,
  VO2max: C.red,
  Anaerobic: C.purple,
  Mixed: C.cyan,
}

function HomeScreen({ ftp, goalFtp, goalTSS }: { ftp: number; goalFtp: number; goalTSS: number }) {
  const ZONES = [
    { z: 1, name: 'Active Recovery', color: '#64748B', min: 0, max: Math.round(ftp * 0.55) },
    { z: 2, name: 'Endurance',       color: C.blue,   min: Math.round(ftp * 0.55), max: Math.round(ftp * 0.75) },
    { z: 3, name: 'Tempo',           color: C.green,  min: Math.round(ftp * 0.76), max: Math.round(ftp * 0.90) },
    { z: 4, name: 'Threshold',       color: C.orange, min: Math.round(ftp * 0.91), max: Math.round(ftp * 1.05) },
    { z: 5, name: 'VO2max',          color: C.red,    min: Math.round(ftp * 1.06), max: Math.round(ftp * 1.20) },
  ]
  const DAYS = ['月', '火', '水', '木', '金', '土', '日']
  const [weeklyTss, setWeeklyTss] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])
  const [tssLoading, setTssLoading] = useState(true)

  useEffect(() => { loadWeeklyTss() }, [ftp])

  async function loadWeeklyTss() {
    setTssLoading(true)
    const token = await getValidToken()
    if (!token) { setTssLoading(false); return }

    // 今週の月曜日 00:00 を Unix 時間で取得
    const now = new Date()
    const diff = now.getDay() === 0 ? 6 : now.getDay() - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - diff)
    monday.setHours(0, 0, 0, 0)
    const after = Math.floor(monday.getTime() / 1000)

    try {
      const activities = await fetchActivitiesSince(after, token)
      const tss = [0, 0, 0, 0, 0, 0, 0]
      for (const act of activities) {
        tss[activityWeekdayIndex(act)] += computeActivityTss(act, ftp)
      }
      setWeeklyTss(tss)
    } catch {}
    setTssLoading(false)
  }

  const totalTss = weeklyTss.reduce((s, v) => s + v, 0)
  const maxTss = Math.max(...weeklyTss, 1)
  const todayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1 })()

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={styles.banner}>
        <Text style={styles.bannerLabel}>現在のFTP</Text>
        <Text style={styles.ftpValue}>{ftp} W</Text>
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 11, color: C.sub }}>目標 FTP: {goalFtp}W</Text>
            <Text style={{ fontSize: 11, color: C.blue }}>{Math.min(Math.round(ftp / goalFtp * 100), 100)}%</Text>
          </View>
          <View style={{ backgroundColor: C.border, borderRadius: 99, height: 5 }}>
            <View style={{ width: `${Math.min(Math.round(ftp / goalFtp * 100), 100)}%` as any, height: 5, backgroundColor: C.blue, borderRadius: 99 }} />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>パワーゾーン（FTP {ftp}W 基準）</Text>
        {ZONES.map(z => (
          <View key={z.z} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: z.color }} />
            <Text style={{ fontSize: 12, color: C.sub, width: 24 }}>Z{z.z}</Text>
            <Text style={{ fontSize: 12, color: C.text, flex: 1 }}>{z.name}</Text>
            <Text style={{ fontSize: 12, color: z.color, fontWeight: '700' }}>{z.min}–{z.max} W</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.sectionTitle}>今週のTSS</Text>
          {tssLoading && <Text style={{ fontSize: 10, color: C.muted }}>取得中...</Text>}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 6 }}>
          {weeklyTss.map((v, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              {v > 0 && (
                <Text style={{ fontSize: 8, color: C.blue, fontWeight: '700' }}>{v}</Text>
              )}
              <View style={{
                width: '100%',
                height: v ? Math.max((v / maxTss) * 44, 4) : 4,
                backgroundColor: i === todayIdx ? C.cyan : v ? C.blue : C.border,
                borderRadius: 4,
                opacity: i > todayIdx ? 0.35 : 1,
              }} />
              <Text style={{ fontSize: 9, color: i === todayIdx ? C.cyan : C.muted, fontWeight: i === todayIdx ? '700' : '400' }}>{DAYS[i]}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <Text style={{ fontSize: 11, color: C.sub }}>
            累計TSS <Text style={{ color: C.text, fontWeight: '700' }}>{totalTss}</Text> / 目標 {goalTSS}
          </Text>
          <Text style={{ fontSize: 11, color: totalTss >= goalTSS ? C.green : C.orange }}>
            {totalTss >= goalTSS ? '🎉 達成！' : `あと ${goalTSS - totalTss}`}
          </Text>
        </View>
        {!tssLoading && weeklyTss.every(v => v === 0) && (
          <Text style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>Stravaと連携するとTSSが自動表示されます</Text>
        )}
      </View>
    </ScrollView>
  )
}

function WeightScreen({ goalWeight }: { goalWeight: number }) {
  const [log, setLog] = useState<{ id: string; d: string; date: string; w: number }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [healthSyncing, setHealthSyncing] = useState(false)
  const [healthMsg, setHealthMsg] = useState('')

  useEffect(() => { fetchWeights() }, [])
  useEffect(() => { if (Platform.OS === 'ios') syncFromHealthKit() }, [])

  async function writeToHealthKit(value: number, dateStr: string) {
    if (Platform.OS !== 'ios') return
    try {
      const d = new Date(dateStr)
      await saveQuantitySample('HKQuantityTypeIdentifierBodyMass', 'kg', value, d, d)
    } catch {}
  }

  async function syncFromHealthKit() {
    setHealthSyncing(true)
    setHealthMsg('')
    try {
      await requestAuthorization({
        toRead: ['HKQuantityTypeIdentifierBodyMass'],
        toShare: ['HKQuantityTypeIdentifierBodyMass'],
      })
      const sample = await getMostRecentQuantitySample('HKQuantityTypeIdentifierBodyMass', 'kg')
      if (!sample) {
        setHealthMsg('ℹ️ ヘルスケアに体重データがありません')
      } else {
        const recordedAt = sample.endDate.toISOString().split('T')[0]
        await supabase.from('weight_log').delete().eq('recorded_at', recordedAt)
        const { error } = await supabase.from('weight_log').insert({ weight: sample.quantity, recorded_at: recordedAt })
        if (error) {
          setHealthMsg('❌ 保存に失敗しました')
        } else {
          setHealthMsg(`✅ ヘルスケアから同期: ${sample.quantity.toFixed(1)} kg`)
          await fetchWeights()
        }
      }
    } catch {
      setHealthMsg('❌ ヘルスケアとの同期に失敗しました')
    }
    setHealthSyncing(false)
    setTimeout(() => setHealthMsg(''), 4000)
  }

  async function fetchWeights() {
    setLoading(true)
    const { data } = await supabase
      .from('weight_log')
      .select('*')
      .order('recorded_at', { ascending: true })
    setLog((data ?? []).map(d => ({
      id: d.id,
      d: new Date(d.recorded_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
      date: d.recorded_at,
      w: parseFloat(d.weight),
    })))
    setLoading(false)
  }

  async function addWeight() {
    const v = parseFloat(input)
    if (!v || v < 30 || v > 200) return
    setSaving(true)
    const today = selectedDate.toISOString().split('T')[0]
    await supabase.from('weight_log').delete().eq('recorded_at', today)
    const { error } = await supabase.from('weight_log').insert({ weight: v, recorded_at: today })
    if (error) {
      setMsg('❌ 保存に失敗しました')
    } else {
      setMsg('✅ 保存しました！')
      setInput('')
      await writeToHealthKit(v, today)
      await fetchWeights()
    }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }
  async function updateWeight(id: string) {
    const v = parseFloat(editValue)
    if (!v || v < 30 || v > 200) return
    const item = log.find(l => l.id === id)
    await supabase.from('weight_log').update({ weight: v }).eq('id', id)
    setEditingId(null)
    setEditValue('')
    if (item) await writeToHealthKit(v, item.date)
    await fetchWeights()
  }
  async function deleteWeight(id: string) {
    await supabase.from('weight_log').delete().eq('id', id)
    await fetchWeights()
  }

  const latest = log.length > 0 ? log[log.length - 1].w : null
  const start = log.length > 0 ? log[0].w : null
  const diff = latest && start ? (latest - start).toFixed(1) : '—'

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[
          { label: '現在', val: latest ? `${latest.toFixed(1)} kg` : '—', color: C.text },
          { label: '目標', val: `${goalWeight} kg`, color: C.cyan },
          { label: '変化', val: `${diff} kg`, color: parseFloat(diff) < 0 ? C.green : C.red },
        ].map((s, i) => (
          <View key={i} style={[styles.card, { flex: 1, padding: 12 }]}>
            <Text style={{ fontSize: 10, color: C.sub, marginBottom: 4 }}>{s.label}</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: s.color }}>{s.val}</Text>
          </View>
        ))}
      </View>
      {/* グラフ */}
      {log.length >= 2 && (() => {
        const minW = Math.min(...log.map(d => d.w)) - 1
        const maxW = Math.max(...log.map(d => d.w)) + 1
        const range = maxW - minW
        const W = 320
        const H = 100
        const pts = log.map((d, i) => ({
          x: (i / (log.length - 1)) * W,
          y: ((maxW - d.w) / range) * (H - 10) + 5,
        }))
        const polyPoints = pts.map(p => `${p.x},${p.y}`).join(' ')
        const areaPoints = [
          ...pts.map(p => `${p.x},${p.y}`),
          `${W},${H}`, `0,${H}`
        ].join(' ')
        const goalY = ((maxW - goalWeight) / range) * (H - 10) + 5

        return (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>体重推移</Text>
            <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
              <Defs>
                <LinearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={C.cyan} stopOpacity={0.3} />
                  <Stop offset="100%" stopColor={C.cyan} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Polygon points={areaPoints} fill="url(#wgrad)" />
              <Polyline points={polyPoints} fill="none" stroke={C.cyan} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              <Line x1={0} y1={goalY} x2={W} y2={goalY} stroke={C.green} strokeWidth={1} strokeDasharray="4,3" />
              {pts.map((p, i) => (
                <Circle key={i} cx={p.x} cy={p.y} r={4} fill={C.bg} stroke={C.cyan} strokeWidth={2} />
              ))}
            </Svg>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              {log.map((d, i) => (
                <Text key={i} style={{ fontSize: 9, color: C.muted }}>{d.d}</Text>
              ))}
            </View>
          </View>
        )
      })()}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>今日の体重を記録</Text>
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            onPress={syncFromHealthKit}
            disabled={healthSyncing}
            style={{ backgroundColor: healthSyncing ? C.surface : `${C.red}18`, borderWidth: 1, borderColor: `${C.red}40`, borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.red }}>{healthSyncing ? '同期中...' : '🍎 ヘルスケアと同期'}</Text>
          </TouchableOpacity>
        )}
        {healthMsg !== '' && (
          <Text style={{ marginBottom: 10, fontSize: 12, color: healthMsg.includes('✅') ? C.green : C.red }}>{healthMsg}</Text>
        )}
        <TouchableOpacity
          onPress={() => setShowDatePicker(v => !v)}
          style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: showDatePicker ? C.blue : C.border, borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={{ color: C.text, fontSize: 14 }}>
            📅 {selectedDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })}
          </Text>
          <Text style={{ color: C.muted, fontSize: 11 }}>{showDatePicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <>
            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                locale="ja-JP"
                themeVariant="light"
                onChange={(_, date) => {
                  if (Platform.OS === 'android') setShowDatePicker(false)
                  if (date) setSelectedDate(date)
                }}
              />
            </View>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={{ backgroundColor: C.blue, borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>完了</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="73.5"
            placeholderTextColor={C.muted}
            keyboardType="decimal-pad"
          />
          <Text style={{ color: C.sub }}>kg</Text>
          <TouchableOpacity style={[styles.btn, { opacity: saving ? 0.5 : 1 }]} onPress={addWeight} disabled={saving}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{saving ? '保存中...' : '記録'}</Text>
          </TouchableOpacity>
        </View>
        {msg !== '' && (
          <Text style={{ marginTop: 8, fontSize: 12, color: msg.includes('✅') ? C.green : C.red }}>{msg}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>履歴</Text>
        {loading ? (
          <Text style={{ color: C.muted, fontSize: 12 }}>読み込み中...</Text>
        ) : log.length === 0 ? (
          <Text style={{ color: C.muted, fontSize: 12 }}>まだデータがありません</Text>
        ) : (
          [...log].reverse().map((d, i) => (
            <View key={i} style={{ paddingVertical: 8, borderBottomWidth: i < log.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: C.sub }}>{d.d}</Text>
                {editingId === d.id ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      style={[styles.input, { width: 80, padding: 6 }]}
                      value={editValue}
                      onChangeText={setEditValue}
                      keyboardType="decimal-pad"
                      placeholderTextColor={C.muted}
                    />
                    <Text style={{ color: C.sub }}>kg</Text>
                    <TouchableOpacity
                      onPress={() => updateWeight(d.id)}
                      style={{ backgroundColor: `${C.green}22`, borderRadius: 6, padding: 6, paddingHorizontal: 10 }}
                    >
                      <Text style={{ fontSize: 11, color: C.green, fontWeight: '700' }}>保存</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setEditingId(null)}
                      style={{ backgroundColor: `${C.muted}22`, borderRadius: 6, padding: 6, paddingHorizontal: 10 }}
                    >
                      <Text style={{ fontSize: 11, color: C.muted, fontWeight: '700' }}>戻る</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{d.w.toFixed(1)} kg</Text>
                    <TouchableOpacity
                      onPress={() => { setEditingId(d.id); setEditValue(d.w.toFixed(1)) }}
                      style={{ backgroundColor: `${C.blue}22`, borderRadius: 6, padding: 6, paddingHorizontal: 10 }}
                    >
                      <Text style={{ fontSize: 11, color: C.blue, fontWeight: '700' }}>編集</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteWeight(d.id)}
                      style={{ backgroundColor: `${C.red}22`, borderRadius: 6, padding: 6, paddingHorizontal: 10 }}
                    >
                      <Text style={{ fontSize: 11, color: C.red, fontWeight: '700' }}>削除</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}
function PlanScreen({ ftp, goalFtp, goalTSS, eventName, eventDate }: { ftp: number; goalFtp: number; goalTSS: number; eventName: string; eventDate: Date }) {
  const [loadingPlan, setLoadingPlan] = useState(true)
  const [activePlan, setActivePlan] = useState<{ plan: TrainingPlanRow; weeks: PlanWeekRow[] } | null>(null)
  const [currentWeekDays, setCurrentWeekDays] = useState<PlanDayRow[]>([])
  const [loadingWeek, setLoadingWeek] = useState(false)

  const [platform, setPlatform] = useState('Zwift')
  const [restDays, setRestDays] = useState<Set<number>>(new Set([1, 3, 6])) // 火,木,日
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)

  const [generatingWeek, setGeneratingWeek] = useState(false)
  const [weekGenError, setWeekGenError] = useState('')

  const [reviewMap, setReviewMap] = useState<Record<string, DayReviewResult>>({})
  const [reviewingDayId, setReviewingDayId] = useState<string | null>(null)

  const daysToRace = Math.max(0, Math.ceil((eventDate.getTime() - Date.now()) / 86400000))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => { loadPlan() }, [])

  function findCurrentWeek(weeks: PlanWeekRow[]): PlanWeekRow | null {
    if (weeks.length === 0) return null
    const match = weeks.find(w => {
      const start = parseDateOnly(w.week_start_date)
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      return today >= start && today < end
    })
    return match || weeks[weeks.length - 1]
  }

  async function loadPlan() {
    setLoadingPlan(true)
    const result = await getActivePlan()
    setActivePlan(result)
    setLoadingPlan(false)
    if (result) await loadCurrentWeek(result.weeks)
  }

  async function loadCurrentWeek(weeks: PlanWeekRow[]) {
    const week = findCurrentWeek(weeks)
    if (!week) return
    setLoadingWeek(true)
    const days = await getPlanDays(week.id)
    setCurrentWeekDays(days)
    await runReviewPass(days)
    setLoadingWeek(false)
  }

  async function runReviewPass(days: PlanDayRow[]) {
    const pastDays = days.filter(d => parseDateOnly(d.date) <= today)
    if (pastDays.length === 0) return
    const token = await getValidToken()
    if (!token) return
    const earliestDate = pastDays.reduce((min, d) => (d.date < min ? d.date : min), pastDays[0].date)
    const after = Math.floor(parseDateOnly(earliestDate).getTime() / 1000)
    let activities: StravaActivity[] = []
    try {
      activities = await fetchActivitiesSince(after, token)
    } catch {
      return
    }
    const byDate = activitiesByLocalDate(activities)
    const results: Record<string, DayReviewResult> = {}
    for (const day of pastDays) {
      const acts = byDate.get(day.date) || []
      const result = classifyDayReview(day, acts, ftp)
      results[day.id] = result
      if (day.review_status !== result.reviewStatus) {
        await updatePlanDayReview(day.id, {
          strava_activity_id: result.stravaActivityId,
          actual_tss: result.actualTss,
          actual_duration: result.actualDuration,
          achievement_pct: result.achievementPct,
          review_status: result.reviewStatus,
        })
      }
    }
    setReviewMap(results)
  }

  function toggleRestDay(idx: number) {
    setRestDays(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  async function createPlan() {
    setCreating(true)
    setCreateError('')
    setConfirmRegenerate(false)
    try {
      const result = await createTrainingPlan({
        eventName,
        eventDate,
        startingFtp: ftp,
        goalFtp,
        weeklyTargetTss: goalTSS,
        platform,
        restDayIndices: Array.from(restDays),
      })
      setActivePlan(result)
      setCurrentWeekDays([])
      setReviewMap({})
      await loadCurrentWeek(result.weeks)
    } catch {
      setCreateError('プランの作成に失敗しました。もう一度試してください。')
    }
    setCreating(false)
  }

  async function generateWeekDetail(week: PlanWeekRow) {
    if (!activePlan) return
    setGeneratingWeek(true)
    setWeekGenError('')
    try {
      const r = await fetch(`${VERCEL_BASE}/api/generate-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ftp,
          targetFtp: goalFtp,
          eventName,
          platform: activePlan.plan.platform,
          phase: week.phase,
          weekTargetTss: week.target_tss,
          isRecoveryWeek: week.is_recovery_week,
          restDayIndices: week.rest_day_indices,
          ftpTestDay: week.ftp_test_day,
        }),
      })
      const data = await r.json()
      if (!Array.isArray(data.days)) throw new Error('no days')
      const weekStart = parseDateOnly(week.week_start_date)
      const days = DAYS_JP.map((label, i) => {
        const src = data.days.find((d: any) => d.day === label) || { type: 'rest' }
        const date = new Date(weekStart)
        date.setDate(date.getDate() + i)
        const type: DayType = src.type === 'ftp_test' ? 'ftp_test' : src.type === 'rest' ? 'rest' : 'workout'
        return {
          date,
          dayOfWeek: i,
          type,
          platform: src.platform ?? null,
          name: src.name ?? null,
          duration: src.duration ?? null,
          plannedTss: src.tss ?? null,
          zone: src.zone ?? null,
          description: src.description ?? null,
        }
      })
      await saveGeneratedWeekDays(week.id, days)
      setActivePlan(prev =>
        prev
          ? { plan: prev.plan, weeks: prev.weeks.map(w => (w.id === week.id ? { ...w, detail_status: 'generated' as const } : w)) }
          : prev
      )
      const refreshed = await getPlanDays(week.id)
      setCurrentWeekDays(refreshed)
      await runReviewPass(refreshed)
    } catch {
      setWeekGenError('生成に失敗しました。もう一度試してください。')
    }
    setGeneratingWeek(false)
  }

  async function generateReviewComment(day: PlanDayRow) {
    setReviewingDayId(day.id)
    try {
      const result = reviewMap[day.id]
      const actualSummary =
        result && result.actualTss !== null ? `${result.actualDuration}分 TSS${result.actualTss}` : null
      const r = await fetch(`${VERCEL_BASE}/api/review-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: day.date,
          dayType: day.type,
          plannedName: day.name,
          plannedDuration: day.duration,
          plannedTss: day.planned_tss,
          plannedZone: day.zone,
          plannedDescription: day.description,
          reviewStatus: result?.reviewStatus || day.review_status,
          actualSummary,
        }),
      })
      const data = await r.json()
      if (data.comment) {
        await updatePlanDayReview(day.id, { review_comment: data.comment })
        setCurrentWeekDays(prev => prev.map(d => (d.id === day.id ? { ...d, review_comment: data.comment } : d)))
      }
    } catch {}
    setReviewingDayId(null)
  }

  const currentWeek = activePlan ? findCurrentWeek(activePlan.weeks) : null
  const phaseColor = currentWeek ? PHASE_COLORS[currentWeek.phase] : C.blue

  if (loadingPlan) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.muted }}>読み込み中...</Text>
      </View>
    )
  }

  if (!activePlan) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={[styles.card, { backgroundColor: '#1A1030', borderColor: C.purple + '40' }]}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 4 }}>🏁 長期トレーニングプランを作成</Text>
          <Text style={{ fontSize: 12, color: C.sub, marginBottom: 14, lineHeight: 18 }}>
            {eventName}（{eventDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}・あと{daysToRace}日）まで、レスト週やFTPテスト日を織り込んだ週ごとの計画を自動で組みます。
          </Text>

          <Text style={{ fontSize: 10, color: C.sub, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>プラットフォーム</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {['Zwift', 'MyWhoosh', '両方'].map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setPlatform(p)}
                style={{
                  flex: 1, padding: 8, borderRadius: 10,
                  backgroundColor: platform === p ? C.blue : C.surface,
                  borderWidth: 1,
                  borderColor: platform === p ? C.blue : C.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: platform === p ? '#fff' : C.sub, textAlign: 'center' }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ fontSize: 10, color: C.sub, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>希望レスト曜日（通常週）</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
            {DAYS_JP.map((day, i) => {
              const isRest = restDays.has(i)
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => toggleRestDay(i)}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                    backgroundColor: isRest ? C.surface : C.purple + '33',
                    borderWidth: 1,
                    borderColor: isRest ? C.border : C.purple,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isRest ? C.muted : C.purple }}>{day}</Text>
                  <Text style={{ fontSize: 8, color: isRest ? C.muted : C.purple, marginTop: 2 }}>{isRest ? '休' : '練'}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            onPress={createPlan}
            disabled={creating}
            style={{ backgroundColor: creating ? C.muted : C.purple, borderRadius: 10, padding: 14 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
              {creating ? '⏳ 作成中...' : '✨ 長期プランを作成する'}
            </Text>
          </TouchableOpacity>
          {createError !== '' && <Text style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{createError}</Text>}
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      {/* ── プラン概要 ── */}
      <View style={[styles.card, { backgroundColor: phaseColor + '12', borderColor: phaseColor + '40' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: phaseColor, fontWeight: '700', letterSpacing: 1 }}>🏁 長期プラン</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.text, marginTop: 4 }}>{activePlan.plan.event_name}</Text>
          </View>
          <View style={{ alignItems: 'center', backgroundColor: phaseColor + '22', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: phaseColor }}>{daysToRace}</Text>
            <Text style={{ fontSize: 9, color: C.sub }}>日後</Text>
          </View>
        </View>

        {currentWeek && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <View style={{ backgroundColor: phaseColor + '30', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: phaseColor }}>Week {currentWeek.week_number}・{currentWeek.phase}</Text>
            </View>
            {currentWeek.is_recovery_week && (
              <View style={{ backgroundColor: C.cyan + '30', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: C.cyan }}>😌 リカバリー週</Text>
              </View>
            )}
            {currentWeek.has_ftp_test && (
              <View style={{ backgroundColor: C.orange + '30', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: C.orange }}>⚡ FTPテスト週</Text>
              </View>
            )}
            <Text style={{ fontSize: 11, color: C.sub }}>週間目標TSS {currentWeek.target_tss}</Text>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
          {activePlan.weeks.map(w => (
            <View
              key={w.id}
              style={{
                width: 30, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                backgroundColor: currentWeek?.id === w.id ? PHASE_COLORS[w.phase] : PHASE_COLORS[w.phase] + '25',
                borderWidth: w.is_recovery_week || w.has_ftp_test ? 1.5 : 0,
                borderColor: w.has_ftp_test ? C.orange : C.cyan,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '800', color: currentWeek?.id === w.id ? '#fff' : PHASE_COLORS[w.phase] }}>
                {w.week_number}
              </Text>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity onPress={() => (confirmRegenerate ? createPlan() : setConfirmRegenerate(true))} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
          <Text style={{ fontSize: 11, color: confirmRegenerate ? C.red : C.muted }}>
            {confirmRegenerate ? 'もう一度タップで再作成（現在のプランは破棄されます）' : '🔄 プランを作り直す'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── 今週の詳細 ── */}
      {currentWeek && currentWeek.detail_status === 'pending' ? (
        <View style={styles.card}>
          <Text style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>今週（Week {currentWeek.week_number}）の詳細ワークアウトはまだ生成されていません。</Text>
          <TouchableOpacity
            onPress={() => generateWeekDetail(currentWeek)}
            disabled={generatingWeek}
            style={{ backgroundColor: generatingWeek ? C.muted : C.purple, borderRadius: 10, padding: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
              {generatingWeek ? '⏳ 生成中...' : '✨ 今週の詳細プランを生成する'}
            </Text>
          </TouchableOpacity>
          {weekGenError !== '' && <Text style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{weekGenError}</Text>}
        </View>
      ) : loadingWeek ? (
        <Text style={{ textAlign: 'center', color: C.muted, padding: 20 }}>読み込み中...</Text>
      ) : (
        currentWeekDays.map(day => {
          const isPast = parseDateOnly(day.date) <= today
          const review = reviewMap[day.id]
          const reviewStatus = review?.reviewStatus || day.review_status
          const reviewLabel = REVIEW_LABELS[reviewStatus]
          const dayLabel = DAYS_JP[day.day_of_week]
          return (
            <View key={day.id} style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.text, width: 28 }}>{dayLabel}</Text>
                {day.type === 'rest' ? (
                  <Text style={{ fontSize: 12, color: C.muted, flex: 1 }}>🛌 休養日</Text>
                ) : (
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 4 }}>
                      {day.type === 'ftp_test' ? '⚡ ' : ''}
                      {day.name}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
                      {day.platform && (
                        <View style={{ backgroundColor: C.orange + '22', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, color: C.orange, fontWeight: '700' }}>{day.platform}</Text>
                        </View>
                      )}
                      {day.duration != null && (
                        <View style={{ backgroundColor: C.muted + '30', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, color: C.sub, fontWeight: '700' }}>{day.duration}分</Text>
                        </View>
                      )}
                      {day.planned_tss != null && (
                        <View style={{ backgroundColor: C.green + '22', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, color: C.green, fontWeight: '700' }}>TSS {day.planned_tss}</Text>
                        </View>
                      )}
                      {day.zone && (
                        <View style={{ backgroundColor: (ZONE_COLORS[day.zone] || C.blue) + '22', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: ZONE_COLORS[day.zone] || C.blue }}>{day.zone}</Text>
                        </View>
                      )}
                    </View>
                    {day.description && <Text style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{day.description}</Text>}
                  </View>
                )}
              </View>

              {isPast && (
                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: reviewLabel.color }}>{reviewLabel.label}</Text>
                    {review?.achievementPct != null && <Text style={{ fontSize: 11, color: C.sub }}>達成率 {review.achievementPct}%</Text>}
                    {review?.actualTss != null && (
                      <Text style={{ fontSize: 11, color: C.sub }}>実績 {review.actualDuration}分 TSS{review.actualTss}</Text>
                    )}
                  </View>
                  {day.review_comment ? (
                    <Text style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 16 }}>💬 {day.review_comment}</Text>
                  ) : (
                    <TouchableOpacity onPress={() => generateReviewComment(day)} disabled={reviewingDayId === day.id} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                      <Text style={{ fontSize: 11, color: reviewingDayId === day.id ? C.muted : C.blue, fontWeight: '700' }}>
                        {reviewingDayId === day.id ? '⏳ 生成中...' : '🤖 AIレビューを見る'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )
        })
      )}
    </ScrollView>
  )
}
function StravaScreen({ onFtpUpdate }: { onFtpUpdate: (ftp: number) => void }) {
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
    if (activities.length === 0) return
    setAnalyzing(true)
    setAiAnalysis(null)
    try {
      const r = await fetch(`${VERCEL_BASE}/api/analyze-activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities: activities.slice(0, 10) }),
      })
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
                  <Text style={{ fontSize: 10, color: C.sub }}>直近の活動から疲労・強度バランスを分析</Text>
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
function GoalsScreen({ ftp, onGoalsChange, onFtpUpdate }: { ftp: number; onGoalsChange: (g: { targetFtp: number; targetTSS: number; eventName: string; targetWeight: number }, ed: Date) => void; onFtpUpdate: (ftp: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ftpInput, setFtpInput] = useState('')
  const [ftpSaving, setFtpSaving] = useState(false)
  const [ftpMsg, setFtpMsg] = useState('')
  const [currentWeight, setCurrentWeight] = useState<number | null>(null)
  const [startWeight, setStartWeight] = useState<number | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)

  const [targetFtp, setTargetFtp] = useState('320')
  const [targetWeight, setTargetWeight] = useState('70.0')
  const [targetTSS, setTargetTSS] = useState('420')
  const [eventName, setEventName] = useState('グランフォンドKyoto')
  const [eventDate, setEventDate] = useState(new Date('2025-10-15'))

  useEffect(() => {
    loadGoals()
    loadWeights()
  }, [])

  async function loadGoals() {
    const json = await AsyncStorage.getItem('user_goals')
    if (!json) return
    const g = JSON.parse(json)
    if (g.targetFtp)    setTargetFtp(g.targetFtp)
    if (g.targetWeight) setTargetWeight(g.targetWeight)
    if (g.targetTSS)    setTargetTSS(g.targetTSS)
    if (g.eventName)    setEventName(g.eventName)
    if (g.eventDate)    setEventDate(new Date(g.eventDate))
  }

  async function saveGoals() {
    setSaving(true)
    await AsyncStorage.setItem('user_goals', JSON.stringify({
      targetFtp, targetWeight, targetTSS, eventName,
      eventDate: eventDate.toISOString(),
    }))
    onGoalsChange({ targetFtp: parseInt(targetFtp) || 320, targetTSS: parseInt(targetTSS) || 420, eventName, targetWeight: parseFloat(targetWeight) || 70 }, eventDate)
    setSaving(false)
    setEditing(false)
  }

  async function saveFtp() {
    const v = parseInt(ftpInput)
    if (!v || v < 50 || v > 600) return
    setFtpSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('ftp_log').insert({ ftp: v, recorded_at: today })
    if (!error) {
      onFtpUpdate(v)
      setFtpMsg(`✅ FTP を ${v}W に更新しました`)
      setFtpInput('')
    } else {
      setFtpMsg('❌ 保存に失敗しました')
    }
    setFtpSaving(false)
    setTimeout(() => setFtpMsg(''), 3000)
  }

  async function loadWeights() {
    const { data } = await supabase
      .from('weight_log')
      .select('weight, recorded_at')
      .order('recorded_at', { ascending: true })
    if (data && data.length > 0) {
      setStartWeight(parseFloat(data[0].weight))
      setCurrentWeight(parseFloat(data[data.length - 1].weight))
    } else {
      setStartWeight(null)
      setCurrentWeight(null)
    }
  }

  const daysToEvent = Math.max(0, Math.ceil((eventDate.getTime() - Date.now()) / 86400000))
  const tFtp = parseFloat(targetFtp)
  const tWeight = parseFloat(targetWeight)
  const ftpPct = Math.min((ftp / tFtp) * 100, 100)
  const wkg = currentWeight ? (ftp / currentWeight).toFixed(2) : null

  // 体重進捗: 開始→現在→目標
  let weightPct = 0
  if (startWeight && currentWeight && startWeight > tWeight) {
    weightPct = Math.min(((startWeight - currentWeight) / (startWeight - tWeight)) * 100, 100)
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >

      {/* イベントカード */}
      <View style={[styles.banner, { flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerLabel, { color: C.orange }]}>🎯 目標イベント</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, marginTop: 6 }}>{eventName}</Text>
          <Text style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
            {eventDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        <View style={{ alignItems: 'center', backgroundColor: C.orange + '22', borderRadius: 16, padding: 16, minWidth: 72 }}>
          <Text style={{ fontSize: 34, fontWeight: '900', color: C.orange, lineHeight: 40 }}>{daysToEvent}</Text>
          <Text style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>日後</Text>
        </View>
      </View>

      {/* W/kg サマリー */}
      {wkg && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { label: '現在FTP',  val: `${ftp} W`,    color: C.blue },
            { label: 'W/kg',     val: `${wkg}`,       color: ftp / (currentWeight!) >= 4 ? C.green : C.orange },
            { label: '目標FTP',  val: `${tFtp} W`,    color: C.cyan },
          ].map((s, i) => (
            <View key={i} style={[styles.card, { flex: 1, padding: 12 }]}>
              <Text style={{ fontSize: 10, color: C.sub, marginBottom: 4 }}>{s.label}</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: s.color }}>{s.val}</Text>
            </View>
          ))}
        </View>
      )}

      {/* FTP進捗 */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={styles.sectionTitle}>FTP目標</Text>
          <Text style={{ fontSize: 12, color: C.blue, fontWeight: '700' }}>{ftpPct.toFixed(1)}%</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.text }}>{ftp} W</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.blue }}>目標 {tFtp} W</Text>
        </View>
        <View style={{ backgroundColor: C.border, borderRadius: 99, height: 8 }}>
          <View style={{ width: `${ftpPct}%` as any, height: 8, backgroundColor: C.blue, borderRadius: 99 }} />
        </View>
        <Text style={{ fontSize: 11, color: C.sub, marginTop: 8 }}>
          {ftp >= tFtp ? '🎉 目標達成！' : `達成まであと +${tFtp - ftp} W`}
        </Text>
      </View>

      {/* FTP手動更新 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>FTPを手動更新</Text>
        <Text style={{ fontSize: 11, color: C.sub, marginBottom: 10 }}>FTPテスト後などに入力してください</Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <TextInput
            style={styles.input}
            value={ftpInput}
            onChangeText={setFtpInput}
            placeholder={`現在 ${ftp}W`}
            placeholderTextColor={C.muted}
            keyboardType="numeric"
          />
          <Text style={{ color: C.sub }}>W</Text>
          <TouchableOpacity
            onPress={saveFtp}
            disabled={ftpSaving}
            style={[styles.btn, { opacity: ftpSaving ? 0.5 : 1 }]}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{ftpSaving ? '保存中...' : '更新'}</Text>
          </TouchableOpacity>
        </View>
        {ftpMsg !== '' && (
          <Text style={{ marginTop: 8, fontSize: 12, color: ftpMsg.includes('✅') ? C.green : C.red }}>{ftpMsg}</Text>
        )}
      </View>

      {/* 体重進捗 */}
      {currentWeight && (
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={styles.sectionTitle}>体重目標</Text>
            {weightPct > 0 && (
              <Text style={{ fontSize: 12, color: C.cyan, fontWeight: '700' }}>{weightPct.toFixed(1)}%</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.text }}>{currentWeight.toFixed(1)} kg</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.cyan }}>目標 {tWeight} kg</Text>
          </View>
          {weightPct > 0 && (
            <View style={{ backgroundColor: C.border, borderRadius: 99, height: 8 }}>
              <View style={{ width: `${weightPct}%` as any, height: 8, backgroundColor: C.cyan, borderRadius: 99 }} />
            </View>
          )}
          <Text style={{ fontSize: 11, color: C.sub, marginTop: 8 }}>
            {currentWeight <= tWeight
              ? '🎉 目標達成！'
              : `達成まであと -${(currentWeight - tWeight).toFixed(1)} kg`}
          </Text>
        </View>
      )}

      {/* 編集ボタン / 編集フォーム */}
      {!editing ? (
        <TouchableOpacity
          onPress={() => setEditing(true)}
          style={[styles.btn, { alignItems: 'center' }]}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>✏️ 目標を編集する</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>目標を設定</Text>

          <Text style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>イベント名</Text>
          <TextInput style={[styles.input, { marginBottom: 12 }]} value={eventName} onChangeText={setEventName} placeholderTextColor={C.muted} />

          <Text style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>開催日</Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(v => !v)}
            style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: showDatePicker ? C.blue : C.border, borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ color: C.text }}>
              📅 {eventDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })}
            </Text>
            <Text style={{ color: C.muted, fontSize: 11 }}>{showDatePicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <>
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                <DateTimePicker
                  value={eventDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  locale="ja-JP"
                  themeVariant="light"
                  onChange={(_, d) => {
                    if (Platform.OS === 'android') setShowDatePicker(false)
                    if (d) setEventDate(d)
                  }}
                />
              </View>
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={{ backgroundColor: C.blue, borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 12 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>完了</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <Text style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>目標FTP</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TextInput style={styles.input} value={targetFtp} onChangeText={setTargetFtp} keyboardType="numeric" placeholderTextColor={C.muted} />
            <Text style={{ color: C.sub }}>W</Text>
          </View>

          <Text style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>目標体重</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TextInput style={styles.input} value={targetWeight} onChangeText={setTargetWeight} keyboardType="decimal-pad" placeholderTextColor={C.muted} />
            <Text style={{ color: C.sub }}>kg</Text>
          </View>

          <Text style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>週間目標TSS</Text>
          <TextInput style={[styles.input, { marginBottom: 16 }]} value={targetTSS} onChangeText={setTargetTSS} keyboardType="numeric" placeholderTextColor={C.muted} />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setEditing(false)}
              style={{ flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, alignItems: 'center' }}
            >
              <Text style={{ color: C.muted, fontWeight: '700' }}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveGoals} disabled={saving} style={[styles.btn, { flex: 1, alignItems: 'center', opacity: saving ? 0.5 : 1 }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? '保存中...' : '保存する'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity onPress={() => supabase.auth.signOut()} style={{ alignItems: 'center', padding: 12 }}>
        <Text style={{ fontSize: 12, color: C.muted }}>ログアウト</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

function AuthScreen() {
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function sendCode() {
    if (!email.trim()) return
    setSending(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    if (error) {
      setError('送信に失敗しました。メールアドレスを確認してください。')
    } else {
      setStage('code')
      setMessage(`${email.trim()} に確認コードを送信しました`)
    }
    setSending(false)
  }

  async function verifyCode() {
    if (!code.trim()) return
    setVerifying(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    if (error) {
      setError('コードが正しくないか、期限切れです。')
    }
    setVerifying(false)
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: C.text, marginBottom: 4 }}>AI CycleNote</Text>
          <Text style={{ fontSize: 13, color: C.sub, marginBottom: 12 }}>
            {stage === 'email' ? 'メールアドレスでログイン' : '届いた6桁コードを入力してください'}
          </Text>

          {stage === 'email' ? (
            <>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <TouchableOpacity
                style={[styles.btn, { alignItems: 'center', opacity: sending ? 0.5 : 1 }]}
                onPress={sendCode}
                disabled={sending}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{sending ? '送信中...' : 'コードを送信'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {message !== '' && <Text style={{ fontSize: 12, color: C.green }}>{message}</Text>}
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={C.muted}
                keyboardType="number-pad"
                textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
                maxLength={6}
              />
              <TouchableOpacity
                style={[styles.btn, { alignItems: 'center', opacity: verifying ? 0.5 : 1 }]}
                onPress={verifyCode}
                disabled={verifying}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{verifying ? '確認中...' : '確認してログイン'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setStage('email'); setCode(''); setMessage(''); setError('') }}>
                <Text style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>メールアドレスを変更する / 再送信</Text>
              </TouchableOpacity>
            </>
          )}

          {error !== '' && <Text style={{ fontSize: 12, color: C.red }}>{error}</Text>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export default function App() {
  const [tab, setTab] = useState('home')
  const [ftp, setFtp] = useState(300)
  const [goals, setGoals] = useState({ targetFtp: 320, targetTSS: 420, eventName: 'グランフォンドKyoto', targetWeight: 70 })
  const [eventDate, setEventDate] = useState(new Date('2025-10-15'))

  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase.from('ftp_log').select('ftp').order('recorded_at', { ascending: false }).limit(1)
      .then(({ data }) => { setFtp(data && data.length > 0 ? data[0].ftp : 300) })
    AsyncStorage.getItem('user_goals').then(json => {
      if (!json) return
      const g = JSON.parse(json)
      setGoals({
        targetFtp:    parseInt(g.targetFtp)    || 320,
        targetTSS:    parseInt(g.targetTSS)    || 420,
        eventName:    g.eventName              || 'グランフォンドKyoto',
        targetWeight: parseFloat(g.targetWeight) || 70,
      })
      if (g.eventDate) setEventDate(new Date(g.eventDate))
    })
  }, [session])

  const screens: Record<string, JSX.Element> = {
    home:   <HomeScreen ftp={ftp} goalFtp={goals.targetFtp} goalTSS={goals.targetTSS} />,
    plan:   <PlanScreen ftp={ftp} goalFtp={goals.targetFtp} goalTSS={goals.targetTSS} eventName={goals.eventName} eventDate={eventDate} />,
    strava: <StravaScreen onFtpUpdate={setFtp} />,
    weight: <WeightScreen goalWeight={goals.targetWeight} />,
    goals:  <GoalsScreen ftp={ftp} onGoalsChange={(g, ed) => { setGoals(g); setEventDate(ed) }} onFtpUpdate={setFtp} />,
  }

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: C.muted }}>読み込み中...</Text>
      </SafeAreaView>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={{ fontSize: 11, color: C.blue, fontWeight: '700', marginBottom: 2 }}>AI CycleNote</Text>
        <Text style={styles.headerTitle}>{TABS.find(t => t.id === tab)?.label}</Text>
      </View>
      <View style={{ flex: 1 }}>{screens[tab]}</View>
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={styles.tabItem} onPress={() => setTab(t.id)}>
            <Text style={{ fontSize: 22, opacity: tab === t.id ? 1 : 0.35 }}>{t.icon}</Text>
            <Text style={[styles.tabLabel, { color: tab === t.id ? C.blue : C.muted }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { padding: 16, paddingBottom: 8 },
  headerTitle:  { fontSize: 22, fontWeight: '900', color: C.text },
  banner:       { backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border },
  bannerLabel:  { fontSize: 12, color: C.blue, fontWeight: '700', marginBottom: 8 },
  ftpValue:     { fontSize: 48, fontWeight: '900', color: C.text },
  tabBar:       { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 8, paddingTop: 8 },
  tabItem:      { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel:     { fontSize: 9, fontWeight: '700' },
  card:         { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  input:        { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, color: C.text, fontSize: 16 },
  btn:          { backgroundColor: C.blue, borderRadius: 10, padding: 10, paddingHorizontal: 18 },
})