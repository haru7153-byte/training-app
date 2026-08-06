import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import DateTimePicker from '@react-native-community/datetimepicker'
import {
  VERCEL_BASE,
  getValidToken,
  activitiesByLocalDate,
  fetchActivitiesSince,
  StravaActivity,
} from '../lib/strava'
import {
  DAYS_JP,
  DayType,
  GoalType,
  Phase,
  TrainingFocus,
  TrainingPlanRow,
  PlanWeekRow,
  PlanDayRow,
  DayReviewResult,
  getActivePlan,
  createTrainingPlan,
  updatePlanGoalName,
  extendOngoingPlan,
  getPlanDays,
  saveGeneratedWeekDays,
  updatePlanDayReview,
  updatePlanDayContent,
  markDayAsRest,
  updateWeekRestDays,
  classifyDayReview,
  parseDateOnly,
  formatDateOnly,
} from '../lib/plan'
import { C, styles, PHASE_COLORS, ZONE_COLORS, REVIEW_LABELS, weekColor } from '../lib/theme'
import { authedPost } from '../lib/apiClient'
import { aiErrorMessage } from '../lib/entitlements'

interface DayAnalysisResult {
  status: string
  analysis: string
  recommendation: string
  tomorrow: {
    type: DayType
    name: string | null
    duration: number | null
    tss: number | null
    zone: string | null
    description: string | null
  } | null
  tomorrowDayId: string | null
}

export default function PlanScreen({ ftp, goalFtp, goalTSS, goal, autoOpenRecreate, onAutoOpenRecreateHandled }: {
  ftp: number
  goalFtp: number
  goalTSS: number
  goal: { type: GoalType; label: string; eventDate: Date | null; ftpTestEnabled: boolean; trainingFocus: TrainingFocus }
  autoOpenRecreate?: boolean
  onAutoOpenRecreateHandled?: () => void
}) {
  const { type: goalType, label: eventName, eventDate, ftpTestEnabled, trainingFocus } = goal
  const [loadingPlan, setLoadingPlan] = useState(true)
  const [activePlan, setActivePlan] = useState<{ plan: TrainingPlanRow; weeks: PlanWeekRow[] } | null>(null)
  const [currentWeekDays, setCurrentWeekDays] = useState<PlanDayRow[]>([])
  const [loadingWeek, setLoadingWeek] = useState(false)

  const [platform, setPlatform] = useState('Zwift')
  const [restDays, setRestDays] = useState<Set<number>>(new Set([1, 3, 6])) // 火,木,日
  const [startDate, setStartDate] = useState(new Date())
  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [showRecreateForm, setShowRecreateForm] = useState(false)

  const [generatingWeek, setGeneratingWeek] = useState(false)
  const [weekGenError, setWeekGenError] = useState('')

  const [reviewMap, setReviewMap] = useState<Record<string, DayReviewResult>>({})
  const [reviewingDayId, setReviewingDayId] = useState<string | null>(null)
  const [markingRestId, setMarkingRestId] = useState<string | null>(null)

  const [dayAnalysis, setDayAnalysis] = useState<Record<string, DayAnalysisResult>>({})
  const [analyzingDayId, setAnalyzingDayId] = useState<string | null>(null)
  const [applyingTomorrowId, setApplyingTomorrowId] = useState<string | null>(null)
  const [appliedTomorrowIds, setAppliedTomorrowIds] = useState<Set<string>>(new Set())
  const [aiErrorByDay, setAiErrorByDay] = useState<Record<string, string>>({})

  const [editingRest, setEditingRest] = useState(false)
  const [pendingRestDays, setPendingRestDays] = useState<Set<number> | null>(null)
  const [savingRestDays, setSavingRestDays] = useState(false)

  const daysToRace = eventDate ? Math.max(0, Math.ceil((eventDate.getTime() - Date.now()) / 86400000)) : null
  // activePlan.plan は実際に保存済みのプランのデータ。フォーム上の goal（未保存の変更を含む）とはズレうるので別に持つ。
  const activeDaysToRace = activePlan?.plan.event_date
    ? Math.max(0, Math.ceil((parseDateOnly(activePlan.plan.event_date).getTime() - Date.now()) / 86400000))
    : null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => { loadPlan() }, [])

  // フォームの初期値を、既存プランがあればその設定に同期する（作り直す時に別設定になってしまうのを防ぐ）
  useEffect(() => {
    if (!activePlan) return
    setPlatform(activePlan.plan.platform)
    setRestDays(new Set(activePlan.plan.rest_day_indices))
    setStartDate(parseDateOnly(activePlan.plan.start_date))
  }, [activePlan?.plan.id])

  // 目標タブで設定を保存すると、この画面を開いた時に「名前だけ変更」か「作り直す」かを確認する
  useEffect(() => {
    if (!autoOpenRecreate || !activePlan) return
    onAutoOpenRecreateHandled?.()
    if (activePlan.plan.event_name === eventName) return
    Alert.alert(
      '目標が変更されました',
      `プランの目標名を新しい「${eventName}」に更新します。トレーニング内容も新しい目標に合わせて作り直しますか？`,
      [
        { text: '後で', style: 'cancel' },
        {
          text: '名前だけ変更',
          onPress: async () => {
            await updatePlanGoalName(activePlan.plan.id, eventName)
            setActivePlan(prev => (prev ? { ...prev, plan: { ...prev.plan, event_name: eventName } } : prev))
          },
        },
        { text: 'プランを作り直す', style: 'destructive', onPress: () => setShowRecreateForm(true) },
      ]
    )
  }, [autoOpenRecreate, activePlan])

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
    if (result) await loadCurrentWeek(result.weeks, result.plan)
  }

  async function loadCurrentWeek(weeks: PlanWeekRow[], plan: TrainingPlanRow) {
    const week = findCurrentWeek(weeks)
    if (!week) return
    setLoadingWeek(true)
    const days = await getPlanDays(week.id)
    setCurrentWeekDays(days)
    await runReviewPass(days)
    setLoadingWeek(false)

    if (plan.goal_type === 'ongoing') {
      await maybeExtendOngoingPlan(plan, weeks, week)
    }
  }

  /** 日付のない（進行中の）目標のプランは、残り週数が減ってきたら次のブロックを自動生成する。 */
  async function maybeExtendOngoingPlan(plan: TrainingPlanRow, weeks: PlanWeekRow[], currentWk: PlanWeekRow) {
    const remaining = weeks.filter(w => w.week_number > currentWk.week_number).length
    if (remaining >= 3) return
    const lastWeek = weeks[weeks.length - 1]
    if (!lastWeek) return

    const multiplier = await new Promise<number>(resolve => {
      Alert.alert(
        '次のブロックを準備します',
        'このまま同じ強度で続けますか？ ペースを調整することもできます。',
        [
          { text: 'ゆるめる', onPress: () => resolve(0.85) },
          { text: 'このまま', onPress: () => resolve(1) },
          { text: 'もっとハードに', onPress: () => resolve(1.15) },
        ],
        { cancelable: false }
      )
    })

    try {
      const newWeeks = await extendOngoingPlan(plan, lastWeek, multiplier)
      setActivePlan(prev => (prev ? { plan: prev.plan, weeks: [...prev.weeks, ...newWeeks] } : prev))
    } catch {
      // 延長に失敗しても致命的ではない。次にこの画面を開いた時にまた判定される。
    }
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

  function openRestDayEditor(week: PlanWeekRow) {
    setPendingRestDays(new Set(week.rest_day_indices))
    setEditingRest(true)
  }

  function closeRestDayEditor() {
    setEditingRest(false)
    setPendingRestDays(null)
  }

  function togglePendingRestDay(idx: number) {
    setPendingRestDays(prev => {
      const next = new Set(prev ?? [])
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function confirmSaveRestDayEdits(week: PlanWeekRow) {
    if (week.detail_status !== 'generated') {
      saveRestDayEdits(week)
      return
    }
    Alert.alert(
      'この週の内容を作り直しますか？',
      `Week ${week.week_number} に生成済みのワークアウト内容は削除され、変更後の休養日で作り直す必要があります。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '保存して作り直す', style: 'destructive', onPress: () => saveRestDayEdits(week) },
      ]
    )
  }

  async function saveRestDayEdits(week: PlanWeekRow) {
    if (!pendingRestDays) return
    setSavingRestDays(true)
    try {
      const indices = Array.from(pendingRestDays)
      await updateWeekRestDays(week.id, indices)
      setActivePlan(prev =>
        prev
          ? {
              plan: prev.plan,
              weeks: prev.weeks.map(w =>
                w.id === week.id ? { ...w, rest_day_indices: indices.sort((a, b) => a - b), detail_status: 'pending' as const } : w
              ),
            }
          : prev
      )
      setCurrentWeekDays([])
      setReviewMap({})
      closeRestDayEditor()
    } catch {
      setWeekGenError('レスト日の変更に失敗しました。もう一度試してください。')
    }
    setSavingRestDays(false)
  }

  function confirmCreatePlan() {
    Alert.alert(
      activePlan ? 'プランを作り直しますか？' : 'プランを作成しますか？',
      activePlan ? '現在のプラン（今週までの記録を含む）は破棄され、新しいプランに置き換わります。この操作は取り消せません。' : undefined,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: activePlan ? '作り直す' : '作成する', style: activePlan ? 'destructive' : 'default', onPress: createPlan },
      ]
    )
  }

  async function createPlan() {
    setCreating(true)
    setCreateError('')
    setShowRecreateForm(false)
    try {
      const result = await createTrainingPlan({
        eventName,
        eventDate,
        startDate,
        startingFtp: ftp,
        goalFtp,
        weeklyTargetTss: goalTSS,
        platform,
        restDayIndices: Array.from(restDays),
        goalType,
        ftpTestEnabled,
      })
      setActivePlan(result)
      setCurrentWeekDays([])
      setReviewMap({})
      await loadCurrentWeek(result.weeks, result.plan)
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
      const r = await authedPost(`${VERCEL_BASE}/api/generate-plan`, {
        ftp,
        targetFtp: goalFtp,
        eventName,
        trainingFocus,
        platform: activePlan.plan.platform,
        phase: week.phase,
        weekTargetTss: week.target_tss,
        isRecoveryWeek: week.is_recovery_week,
        restDayIndices: week.rest_day_indices,
        ftpTestDay: week.ftp_test_day,
      })
      if (!r.ok) {
        setWeekGenError(aiErrorMessage(r.status))
        setGeneratingWeek(false)
        return
      }
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
    setAiErrorByDay(prev => ({ ...prev, [day.id]: '' }))
    try {
      const result = reviewMap[day.id]
      const actualSummary =
        result && result.actualTss !== null ? `${result.actualDuration}分 TSS${result.actualTss}` : null
      const r = await authedPost(`${VERCEL_BASE}/api/review-day`, {
        date: day.date,
        dayType: day.type,
        plannedName: day.name,
        plannedDuration: day.duration,
        plannedTss: day.planned_tss,
        plannedZone: day.zone,
        plannedDescription: day.description,
        reviewStatus: result?.reviewStatus || day.review_status,
        actualSummary,
      })
      if (!r.ok) {
        setAiErrorByDay(prev => ({
          ...prev,
          [day.id]: aiErrorMessage(r.status),
        }))
        setReviewingDayId(null)
        return
      }
      const data = await r.json()
      if (data.comment) {
        await updatePlanDayReview(day.id, { review_comment: data.comment })
        setCurrentWeekDays(prev => prev.map(d => (d.id === day.id ? { ...d, review_comment: data.comment } : d)))
      }
    } catch {
      setAiErrorByDay(prev => ({ ...prev, [day.id]: '通信エラーが発生しました。もう一度お試しください。' }))
    }
    setReviewingDayId(null)
  }

  async function analyzeDay(day: PlanDayRow) {
    setAnalyzingDayId(day.id)
    setAiErrorByDay(prev => ({ ...prev, [day.id]: '' }))
    try {
      const result = reviewMap[day.id]

      const tomorrowDate = parseDateOnly(day.date)
      tomorrowDate.setDate(tomorrowDate.getDate() + 1)
      const tomorrowStr = formatDateOnly(tomorrowDate)
      const tomorrowDay = currentWeekDays.find(d => d.date === tomorrowStr) || null

      const recentHistory = currentWeekDays
        .filter(d => parseDateOnly(d.date) <= today)
        .map(d => `${DAYS_JP[d.day_of_week]}:${REVIEW_LABELS[reviewMap[d.id]?.reviewStatus || d.review_status].label}`)

      const r = await authedPost(`${VERCEL_BASE}/api/analyze-day`, {
        ftp,
        goalFtp,
        platform: activePlan?.plan.platform || 'Zwift',
        planned: {
          type: day.type,
          name: day.name,
          duration: day.duration,
          tss: day.planned_tss,
          zone: day.zone,
          description: day.description,
        },
        actual:
          result && result.actualTss !== null
            ? {
                duration: result.actualDuration,
                tss: result.actualTss,
                avgWatts: result.avgWatts,
                weightedAvgWatts: result.weightedAvgWatts,
                avgHeartrate: result.avgHeartrate,
                maxHeartrate: result.maxHeartrate,
                avgCadence: result.avgCadence,
              }
            : null,
        reviewStatus: result?.reviewStatus || day.review_status,
        recentHistory,
        tomorrowDayLabel: tomorrowDay ? DAYS_JP[tomorrowDay.day_of_week] : null,
        tomorrowIsRestDay: tomorrowDay ? tomorrowDay.type === 'rest' : null,
      })
      if (!r.ok) {
        setAiErrorByDay(prev => ({
          ...prev,
          [day.id]: aiErrorMessage(r.status),
        }))
        setAnalyzingDayId(null)
        return
      }
      const data = await r.json()
      if (data.status) {
        const tomorrow = data.tomorrow
          ? {
              ...data.tomorrow,
              type: data.tomorrow.type === 'ftp_test' ? 'ftp_test' : data.tomorrow.type === 'rest' ? 'rest' : 'workout',
            }
          : null
        setDayAnalysis(prev => ({
          ...prev,
          [day.id]: { ...data, tomorrow, tomorrowDayId: tomorrowDay?.id ?? null },
        }))
      } else {
        setAiErrorByDay(prev => ({ ...prev, [day.id]: '分析に失敗しました。もう一度お試しください。' }))
      }
    } catch {
      setAiErrorByDay(prev => ({ ...prev, [day.id]: '通信エラーが発生しました。もう一度お試しください。' }))
    }
    setAnalyzingDayId(null)
  }

  function applyTomorrowSuggestion(todayDayId: string) {
    const result = dayAnalysis[todayDayId]
    if (!result?.tomorrow || !result.tomorrowDayId) return
    const tomorrowDayId = result.tomorrowDayId
    const suggestion = result.tomorrow
    Alert.alert(
      '明日のプランを書き換える',
      '提案された内容で明日の予定を上書きします。よろしいですか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '書き換える',
          onPress: async () => {
            setApplyingTomorrowId(todayDayId)
            await updatePlanDayContent(tomorrowDayId, {
              type: suggestion.type,
              name: suggestion.name,
              duration: suggestion.duration,
              plannedTss: suggestion.tss,
              zone: suggestion.zone,
              description: suggestion.description,
            })
            setCurrentWeekDays(prev =>
              prev.map(d =>
                d.id === tomorrowDayId
                  ? {
                      ...d,
                      type: suggestion.type,
                      name: suggestion.name,
                      duration: suggestion.duration,
                      planned_tss: suggestion.tss,
                      zone: suggestion.zone,
                      description: suggestion.description,
                    }
                  : d
              )
            )
            setAppliedTomorrowIds(prev => new Set(prev).add(todayDayId))
            setApplyingTomorrowId(null)
          },
        },
      ]
    )
  }

  function markAsRest(day: PlanDayRow) {
    Alert.alert(
      '今日はレスト日にする',
      '予定していたワークアウトは消え、休養日として記録されます。無理に運動しなくて大丈夫です。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'レスト日にする',
          onPress: async () => {
            setMarkingRestId(day.id)
            await markDayAsRest(day.id)
            setCurrentWeekDays(prev =>
              prev.map(d =>
                d.id === day.id
                  ? {
                      ...d,
                      type: 'rest',
                      platform: null,
                      name: null,
                      duration: null,
                      planned_tss: null,
                      zone: null,
                      description: null,
                      review_status: 'rest_ok',
                      review_comment: null,
                    }
                  : d
              )
            )
            setReviewMap(prev => ({
              ...prev,
              [day.id]: {
                reviewStatus: 'rest_ok', actualTss: null, actualDuration: null, achievementPct: null, stravaActivityId: null,
                avgWatts: null, weightedAvgWatts: null, avgHeartrate: null, maxHeartrate: null, avgCadence: null,
              },
            }))
            setMarkingRestId(null)
          },
        },
      ]
    )
  }

  const currentWeek = activePlan ? findCurrentWeek(activePlan.weeks) : null
  const phaseColor = currentWeek && activePlan ? weekColor(currentWeek, activePlan.plan) : C.blue

  // 週を連続するフェーズごとにまとめて、今どの区間の何週目にいるかを表示するためのもの
  const phaseSegments: { phase: Phase; weeks: PlanWeekRow[] }[] = []
  for (const w of activePlan?.weeks ?? []) {
    const last = phaseSegments[phaseSegments.length - 1]
    if (last && last.phase === w.phase) last.weeks.push(w)
    else phaseSegments.push({ phase: w.phase, weeks: [w] })
  }
  const currentPhaseSegment = phaseSegments.find(seg => currentWeek && seg.weeks.some(w => w.id === currentWeek.id))
  const weekIndexInPhase = currentPhaseSegment && currentWeek ? currentPhaseSegment.weeks.findIndex(w => w.id === currentWeek.id) + 1 : null

  const todayStr = formatDateOnly(today)
  const todayDay = currentWeekDays.find(d => d.date === todayStr) || null
  const todayReview = todayDay ? reviewMap[todayDay.id] : undefined
  const todayScore = todayReview?.achievementPct != null ? Math.min(Math.round(todayReview.achievementPct), 100) : null
  const todayScoreColor = todayScore == null ? C.sub : todayScore >= 85 ? C.green : C.orange

  // 今週、ここまでで「取り組めた」日数（1日サボると0に戻る連続記録ではなく、積み上げで見せる）
  const elapsedDaysThisWeek = currentWeekDays.filter(d => parseDateOnly(d.date) <= today)
  const onTrackDaysThisWeek = elapsedDaysThisWeek.filter(d => {
    const status = reviewMap[d.id]?.reviewStatus || d.review_status
    return status === 'completed' || status === 'partial' || status === 'rest_ok'
  }).length
  const weekWorkoutScores = currentWeekDays
    .map(d => reviewMap[d.id]?.achievementPct)
    .filter((v): v is number => v != null)
  const weekAvgScore =
    weekWorkoutScores.length > 0 ? Math.round(weekWorkoutScores.reduce((s, v) => s + Math.min(v, 100), 0) / weekWorkoutScores.length) : null

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
          <Text style={{ fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 4 }}>🏁 長期トレーニングプランを作成</Text>
          <Text style={{ fontSize: 14, color: C.sub, marginBottom: 14, lineHeight: 18 }}>
            {goalType === 'race' && eventDate
              ? `${eventName}（${eventDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}・あと${daysToRace}日）まで、レスト週やFTPテスト日を織り込んだ週ごとの計画を自動で組みます。`
              : `「${eventName}」に向けて、負荷を上げる週と回復週を繰り返す長期プランを自動で組みます。目標達成まで区切りなく続けられます。`}
          </Text>

          <Text style={{ fontSize: 12, color: C.sub, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>プラットフォーム</Text>
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
                <Text style={{ fontSize: 14, fontWeight: '700', color: platform === p ? '#fff' : C.sub, textAlign: 'center' }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ fontSize: 12, color: C.sub, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>希望レスト曜日（通常週）</Text>
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
                  <Text style={{ fontSize: 14, fontWeight: '700', color: isRest ? C.muted : C.purple }}>{day}</Text>
                  <Text style={{ fontSize: 9, color: isRest ? C.muted : C.purple, marginTop: 2 }}>{isRest ? '休' : '練'}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={{ fontSize: 12, color: C.sub, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>プラン開始日</Text>
          <TouchableOpacity
            onPress={() => setShowStartDatePicker(v => !v)}
            style={{
              backgroundColor: C.surface, borderWidth: 1, borderColor: showStartDatePicker ? C.purple : C.border,
              borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: C.text, fontSize: 14 }}>
              📅 {startDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })}
            </Text>
            <Text style={{ color: C.muted, fontSize: 11 }}>{showStartDatePicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showStartDatePicker && (
            <>
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  locale="ja-JP"
                  themeVariant="light"
                  onChange={(_, date) => {
                    if (Platform.OS === 'android') setShowStartDatePicker(false)
                    if (date) setStartDate(date)
                  }}
                />
              </View>
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  onPress={() => setShowStartDatePicker(false)}
                  style={{ backgroundColor: C.purple, borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 8 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>完了</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          <Text style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 16 }}>
            フェーズ配分（Base/Build/Peak/Taper）はこの日を起点に計算されます。作り直すときも同じ開始日にすれば、配分がズレません。
          </Text>

          <TouchableOpacity
            onPress={createPlan}
            disabled={creating}
            style={{ backgroundColor: creating ? C.muted : C.purple, borderRadius: 10, padding: 14 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, textAlign: 'center' }}>
              {creating ? '⏳ 作成中...' : '✨ 長期プランを作成する'}
            </Text>
          </TouchableOpacity>
          {createError !== '' && <Text style={{ fontSize: 14, color: C.red, marginTop: 8 }}>{createError}</Text>}
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      {/* ── 今日の採点 ── */}
      {todayDay && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: (todayDay.type === 'rest' ? C.cyan : todayScoreColor) + '14',
              borderColor: (todayDay.type === 'rest' ? C.cyan : todayScoreColor) + '40',
            },
          ]}
        >
          <Text style={{ fontSize: 12, color: C.sub, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>
            今日の採点・{today.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}（{DAYS_JP[todayDay.day_of_week]}）
          </Text>

          {todayDay.type === 'rest' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.cyan + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 32 }}>😴</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>計画通りの休養日</Text>
                <Text style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>回復もトレーニングのうちです</Text>
              </View>
            </View>
          ) : todayScore == null ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.muted + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 28 }}>⏳</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{todayDay.name || 'ワークアウト予定'}</Text>
                  <Text style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>実施してStravaに同期すると、ここに採点が表示されます</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => markAsRest(todayDay)}
                disabled={markingRestId === todayDay.id}
                style={{ marginTop: 12, backgroundColor: C.muted + '18', borderRadius: 10, padding: 10, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.sub }}>
                  {markingRestId === todayDay.id ? '変更中...' : '😴 今日はレスト日にする'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 72, height: 72 }}>
                <Svg width={72} height={72} viewBox="0 0 72 72">
                  <Circle cx={36} cy={36} r={30} fill="none" stroke={C.border} strokeWidth={7} />
                  <Circle
                    cx={36} cy={36} r={30} fill="none" stroke={todayScoreColor} strokeWidth={7}
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 30}`}
                    strokeDashoffset={`${2 * Math.PI * 30 * (1 - todayScore / 100)}`}
                    transform="rotate(-90 36 36)"
                  />
                </Svg>
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: todayScoreColor }}>{todayScore}</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{todayDay.name}</Text>
                <Text style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
                  予定 {todayDay.duration}分・TSS{todayDay.planned_tss}　実績 {todayReview?.actualDuration}分・TSS{todayReview?.actualTss}
                </Text>
              </View>
            </View>
          )}

          {todayDay.type !== 'rest' && todayScore == null ? null : todayDay.review_comment ? (
            <Text style={{ fontSize: 13, color: C.sub, marginTop: 12, lineHeight: 16 }}>💬 {todayDay.review_comment}</Text>
          ) : (
            <TouchableOpacity onPress={() => generateReviewComment(todayDay)} disabled={reviewingDayId === todayDay.id} style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 13, color: reviewingDayId === todayDay.id ? C.muted : C.blue, fontWeight: '700' }}>
                {reviewingDayId === todayDay.id ? '⏳ 生成中...' : '🤖 AIレビューを見る'}
              </Text>
            </TouchableOpacity>
          )}

          {aiErrorByDay[todayDay.id] ? (
            <Text style={{ fontSize: 12, color: C.orange, marginTop: 8, lineHeight: 16 }}>🔒 {aiErrorByDay[todayDay.id]}</Text>
          ) : null}

          {todayScore != null && (
            <View style={{ marginTop: 10 }}>
              {!dayAnalysis[todayDay.id] ? (
                <TouchableOpacity
                  onPress={() => analyzeDay(todayDay)}
                  disabled={analyzingDayId === todayDay.id}
                  style={{ backgroundColor: C.purple + '18', borderRadius: 10, padding: 10, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: analyzingDayId === todayDay.id ? C.muted : C.purple }}>
                    {analyzingDayId === todayDay.id ? '⏳ 分析中...' : '🔍 パワー・心拍・ケイデンスを詳しく分析する'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ gap: 10 }}>
                  <View>
                    <Text style={{ fontSize: 10, color: C.sub, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 }}>今の状態</Text>
                    <Text style={{ fontSize: 13, color: C.text, lineHeight: 18 }}>{dayAnalysis[todayDay.id].status}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 10, color: C.sub, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 }}>詳しい分析</Text>
                    <Text style={{ fontSize: 13, color: C.text, lineHeight: 18 }}>{dayAnalysis[todayDay.id].analysis}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 10, color: C.sub, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 }}>次にすべきこと</Text>
                    <Text style={{ fontSize: 13, color: C.text, lineHeight: 18 }}>{dayAnalysis[todayDay.id].recommendation}</Text>
                  </View>

                  {dayAnalysis[todayDay.id].tomorrow && (
                    <View style={{ backgroundColor: C.blue + '14', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.blue + '30' }}>
                      <Text style={{ fontSize: 10, color: C.blue, fontWeight: '700', letterSpacing: 0.5 }}>💡 明日の提案</Text>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginTop: 4 }}>
                        {dayAnalysis[todayDay.id].tomorrow!.type === 'rest' ? '😴 休養日' : dayAnalysis[todayDay.id].tomorrow!.name}
                      </Text>
                      {dayAnalysis[todayDay.id].tomorrow!.type !== 'rest' && (
                        <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
                          {dayAnalysis[todayDay.id].tomorrow!.duration}分・TSS{dayAnalysis[todayDay.id].tomorrow!.tss}・{dayAnalysis[todayDay.id].tomorrow!.zone}
                        </Text>
                      )}
                      {dayAnalysis[todayDay.id].tomorrow!.description && (
                        <Text style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 16 }}>
                          {dayAnalysis[todayDay.id].tomorrow!.description}
                        </Text>
                      )}
                      {appliedTomorrowIds.has(todayDay.id) ? (
                        <Text style={{ fontSize: 12, color: C.green, fontWeight: '700', marginTop: 8 }}>✅ プランに反映済み</Text>
                      ) : dayAnalysis[todayDay.id].tomorrowDayId ? (
                        <TouchableOpacity
                          onPress={() => applyTomorrowSuggestion(todayDay.id)}
                          disabled={applyingTomorrowId === todayDay.id}
                          style={{ marginTop: 8, backgroundColor: C.blue, borderRadius: 8, padding: 9, alignItems: 'center' }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                            {applyingTomorrowId === todayDay.id ? '反映中...' : 'この内容で明日のプランを書き換える'}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 15 }}>
                          来週分はまだ生成されていないため、自動では反映できません
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {elapsedDaysThisWeek.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <View style={{ flex: 1, backgroundColor: (todayDay.type === 'rest' ? C.cyan : todayScoreColor) + '18', borderRadius: 10, padding: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: todayDay.type === 'rest' ? C.cyan : todayScoreColor }}>
                  {onTrackDaysThisWeek}/{elapsedDaysThisWeek.length}日
                </Text>
                <Text style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>今週取り組めた日</Text>
              </View>
              {weekAvgScore != null && (
                <View style={{ flex: 1, backgroundColor: (todayDay.type === 'rest' ? C.cyan : todayScoreColor) + '18', borderRadius: 10, padding: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: todayDay.type === 'rest' ? C.cyan : todayScoreColor }}>{weekAvgScore}点</Text>
                  <Text style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>週間平均(運動日)</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── プラン概要 ── */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: C.purple, fontWeight: '700', letterSpacing: 1 }}>🏁 長期プラン</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: C.text, marginTop: 4 }}>{activePlan.plan.event_name}</Text>
          </View>
          <View style={{ alignItems: 'center', backgroundColor: C.purple + '18', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
            {activePlan.plan.goal_type === 'race' && activeDaysToRace != null ? (
              <>
                <Text style={{ fontSize: 26, fontWeight: '900', color: C.purple }}>{activeDaysToRace}</Text>
                <Text style={{ fontSize: 10, color: C.sub }}>日後</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 26, fontWeight: '900', color: C.purple }}>{activePlan.weeks.length}</Text>
                <Text style={{ fontSize: 10, color: C.sub }}>週目まで生成済</Text>
              </>
            )}
          </View>
        </View>

        {currentWeek && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <View style={{ backgroundColor: phaseColor + '30', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: phaseColor }}>
                Week {currentWeek.week_number}
                {activePlan.plan.goal_type === 'race' ? `/${activePlan.weeks.length}` : ''}・{currentWeek.phase}期
                {currentPhaseSegment && weekIndexInPhase ? `（${weekIndexInPhase}/${currentPhaseSegment.weeks.length}週目）` : ''}
              </Text>
            </View>
            {currentWeek.is_recovery_week && (
              <View style={{ backgroundColor: C.cyan + '30', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.cyan }}>😌 リカバリー週</Text>
              </View>
            )}
            {currentWeek.has_ftp_test && (
              <View style={{ backgroundColor: C.orange + '30', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.orange }}>⚡ FTPテスト週</Text>
              </View>
            )}
            <Text style={{ fontSize: 13, color: C.sub }}>週間目標TSS {currentWeek.target_tss}</Text>
          </View>
        )}

        {phaseSegments.length > 0 && (
          <View style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', gap: 3, height: 22 }}>
              {phaseSegments.map((seg, i) => {
                const isCurrent = seg === currentPhaseSegment
                return (
                  <View
                    key={i}
                    style={{
                      flex: seg.weeks.length, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isCurrent ? PHASE_COLORS[seg.phase] : PHASE_COLORS[seg.phase] + '30',
                      borderWidth: isCurrent ? 1.5 : 0,
                      borderColor: '#fff',
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 9, fontWeight: '800', color: isCurrent ? '#fff' : PHASE_COLORS[seg.phase] }}
                    >
                      {seg.phase}
                    </Text>
                  </View>
                )
              })}
            </View>
            <Text style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
              {activePlan.plan.goal_type === 'race'
                ? 'Base → Build → Peak → Taper（現在地は白枠のフェーズ）'
                : 'Build 3週 → 回復1週 を繰り返し中（現在地は白枠のフェーズ）'}
            </Text>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
          {activePlan.weeks.map(w => {
            const wColor = weekColor(w, activePlan.plan)
            return (
              <View
                key={w.id}
                style={{
                  width: 30, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: currentWeek?.id === w.id ? wColor : wColor + '25',
                  borderWidth: w.is_recovery_week || w.has_ftp_test ? 1.5 : 0,
                  borderColor: w.has_ftp_test ? C.orange : C.cyan,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: currentWeek?.id === w.id ? '#fff' : wColor }}>
                  {w.week_number}
                </Text>
              </View>
            )
          })}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
          {currentWeek && (
            <TouchableOpacity onPress={() => (editingRest ? closeRestDayEditor() : openRestDayEditor(currentWeek))}>
              <Text style={{ fontSize: 13, color: editingRest ? C.red : C.blue, fontWeight: '700' }}>
                {editingRest ? '✕ 編集をやめる' : '✏️ レスト日を編集'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowRecreateForm(v => !v)}>
            <Text style={{ fontSize: 13, color: showRecreateForm ? C.red : C.muted, fontWeight: '700' }}>
              {showRecreateForm ? '✕ 作り直すのをやめる' : '🔄 プランを作り直す'}
            </Text>
          </TouchableOpacity>
        </View>

        {showRecreateForm && (
          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border, borderStyle: 'dashed' }}>
            <Text style={{ fontSize: 13, color: C.sub, lineHeight: 16, marginBottom: 12 }}>
              現在のプランの設定を引き継いでいます。開始日を変えなければフェーズ配分はズレません。内容を確認・調整してから作り直してください。
            </Text>

            <Text style={{ fontSize: 12, color: C.sub, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>プラットフォーム</Text>
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
                  <Text style={{ fontSize: 14, fontWeight: '700', color: platform === p ? '#fff' : C.sub, textAlign: 'center' }}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 12, color: C.sub, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>希望レスト曜日（通常週）</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
              {DAYS_JP.map((day, i) => {
                const isRest = restDays.has(i)
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => toggleRestDay(i)}
                    style={{
                      flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                      backgroundColor: isRest ? C.surface : C.blue + '33',
                      borderWidth: 1,
                      borderColor: isRest ? C.border : C.blue,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isRest ? C.muted : C.blue }}>{day}</Text>
                    <Text style={{ fontSize: 9, color: isRest ? C.muted : C.blue, marginTop: 2 }}>{isRest ? '休' : '練'}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Text style={{ fontSize: 12, color: C.sub, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>プラン開始日</Text>
            <TouchableOpacity
              onPress={() => setShowStartDatePicker(v => !v)}
              style={{
                backgroundColor: C.surface, borderWidth: 1, borderColor: showStartDatePicker ? C.blue : C.border,
                borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: C.text, fontSize: 14 }}>
                📅 {startDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })}
              </Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>{showStartDatePicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showStartDatePicker && (
              <>
                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    locale="ja-JP"
                    themeVariant="light"
                    onChange={(_, date) => {
                      if (Platform.OS === 'android') setShowStartDatePicker(false)
                      if (date) setStartDate(date)
                    }}
                  />
                </View>
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    onPress={() => setShowStartDatePicker(false)}
                    style={{ backgroundColor: C.blue, borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 8 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>完了</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <TouchableOpacity
              onPress={confirmCreatePlan}
              disabled={creating}
              style={{ backgroundColor: creating ? C.muted : C.red, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 4 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{creating ? '作成中...' : 'この内容で作り直す'}</Text>
            </TouchableOpacity>
            {createError !== '' && <Text style={{ fontSize: 13, color: C.red, marginTop: 8 }}>{createError}</Text>}
          </View>
        )}

        {editingRest && currentWeek && pendingRestDays && (
          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border, borderStyle: 'dashed' }}>
            <Text style={{ fontSize: 13, color: C.sub, lineHeight: 16, marginBottom: 10 }}>
              Week {currentWeek.week_number} の休養曜日をタップして変更します。保存すると、この週のワークアウト内容を作り直します。
            </Text>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {DAYS_JP.map((label, i) => {
                const isRest = pendingRestDays.has(i)
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => togglePendingRestDay(i)}
                    style={{
                      flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center',
                      backgroundColor: isRest ? C.muted + '30' : C.orange + '22',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: isRest ? C.sub : C.orange }}>{label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <TouchableOpacity
              onPress={() => confirmSaveRestDayEdits(currentWeek)}
              disabled={savingRestDays}
              style={{ backgroundColor: savingRestDays ? C.muted : C.blue, borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 12 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{savingRestDays ? '保存中...' : '変更を保存'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── 今週の詳細 ── */}
      {currentWeek && currentWeek.detail_status === 'pending' ? (
        <View style={styles.card}>
          <Text style={{ fontSize: 14, color: C.sub, marginBottom: 10 }}>今週（Week {currentWeek.week_number}）の詳細ワークアウトはまだ生成されていません。</Text>
          <TouchableOpacity
            onPress={() => generateWeekDetail(currentWeek)}
            disabled={generatingWeek}
            style={{ backgroundColor: generatingWeek ? C.muted : C.purple, borderRadius: 10, padding: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, textAlign: 'center' }}>
              {generatingWeek ? '⏳ 生成中...' : '✨ 今週の詳細プランを生成する'}
            </Text>
          </TouchableOpacity>
          {weekGenError !== '' && <Text style={{ fontSize: 14, color: C.red, marginTop: 8 }}>{weekGenError}</Text>}
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
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, width: 28 }}>{dayLabel}</Text>
                {day.type === 'rest' ? (
                  <Text style={{ fontSize: 14, color: C.muted, flex: 1 }}>🛌 休養日</Text>
                ) : (
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 }}>
                      {day.type === 'ftp_test' ? '⚡ ' : ''}
                      {day.name}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
                      {day.platform && (
                        <View style={{ backgroundColor: C.orange + '22', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 12, color: C.orange, fontWeight: '700' }}>{day.platform}</Text>
                        </View>
                      )}
                      {day.duration != null && (
                        <View style={{ backgroundColor: C.muted + '30', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 12, color: C.sub, fontWeight: '700' }}>{day.duration}分</Text>
                        </View>
                      )}
                      {day.planned_tss != null && (
                        <View style={{ backgroundColor: C.green + '22', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 12, color: C.green, fontWeight: '700' }}>TSS {day.planned_tss}</Text>
                        </View>
                      )}
                      {day.zone && (
                        <View style={{ backgroundColor: (ZONE_COLORS[day.zone] || C.blue) + '22', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: ZONE_COLORS[day.zone] || C.blue }}>{day.zone}</Text>
                        </View>
                      )}
                    </View>
                    {day.description && <Text style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{day.description}</Text>}
                  </View>
                )}
              </View>

              {isPast && (
                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: reviewLabel.color }}>{reviewLabel.label}</Text>
                    {review?.achievementPct != null && <Text style={{ fontSize: 13, color: C.sub }}>達成率 {review.achievementPct}%</Text>}
                    {review?.actualTss != null && (
                      <Text style={{ fontSize: 13, color: C.sub }}>実績 {review.actualDuration}分 TSS{review.actualTss}</Text>
                    )}
                  </View>
                  {day.review_comment ? (
                    <Text style={{ fontSize: 13, color: C.sub, marginTop: 6, lineHeight: 16 }}>💬 {day.review_comment}</Text>
                  ) : (
                    <TouchableOpacity onPress={() => generateReviewComment(day)} disabled={reviewingDayId === day.id} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                      <Text style={{ fontSize: 13, color: reviewingDayId === day.id ? C.muted : C.blue, fontWeight: '700' }}>
                        {reviewingDayId === day.id ? '⏳ 生成中...' : '🤖 AIレビューを見る'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {aiErrorByDay[day.id] ? (
                    <Text style={{ fontSize: 12, color: C.orange, marginTop: 6, lineHeight: 16 }}>🔒 {aiErrorByDay[day.id]}</Text>
                  ) : null}
                </View>
              )}
            </View>
          )
        })
      )}
    </ScrollView>
  )
}
