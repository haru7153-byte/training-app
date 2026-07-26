import { supabase } from './supabase'
import { StravaActivity, computeActivityTss } from './strava'

export const DAYS_JP = ['月', '火', '水', '木', '金', '土', '日'] as const

export type Phase = 'Base' | 'Build' | 'Peak' | 'Taper'
export type DayType = 'workout' | 'rest' | 'ftp_test'
export type ReviewStatus = 'pending' | 'completed' | 'partial' | 'not_done' | 'rest_ok' | 'rest_skipped'
export type GoalType = 'race' | 'ongoing'
export type TrainingFocus = 'balanced' | 'climbing' | 'criterium'

/** How many weeks to generate at a time for a date-less "ongoing" goal. */
export const ONGOING_BLOCK_SIZE = 8

export interface WeekPlan {
  weekNumber: number
  weekStartDate: Date
  phase: Phase
  isRecoveryWeek: boolean
  hasFtpTest: boolean
  ftpTestDay: number | null
  targetTss: number
  restDayIndices: number[]
}

export interface PlanDayDraft {
  date: Date
  dayOfWeek: number
  type: DayType
}

export interface TrainingPlanRow {
  id: string
  event_name: string
  event_date: string | null
  start_date: string
  starting_ftp: number
  goal_ftp: number
  weekly_target_tss: number
  platform: string
  rest_day_indices: number[]
  status: 'active' | 'archived'
  created_at: string
  goal_type: GoalType
  ftp_test_enabled: boolean
}

export interface PlanWeekRow {
  id: string
  plan_id: string
  week_number: number
  week_start_date: string
  phase: Phase
  is_recovery_week: boolean
  has_ftp_test: boolean
  ftp_test_day: number | null
  target_tss: number
  rest_day_indices: number[]
  detail_status: 'pending' | 'generated'
}

export interface PlanDayRow {
  id: string
  plan_week_id: string
  date: string
  day_of_week: number
  type: DayType
  platform: string | null
  name: string | null
  duration: number | null
  planned_tss: number | null
  zone: string | null
  description: string | null
  strava_activity_id: number | null
  actual_tss: number | null
  actual_duration: number | null
  achievement_pct: number | null
  review_status: ReviewStatus
  review_comment: string | null
}

// JS getDay()=0(Sun)..6(Sat) -> app convention 0(Mon)..6(Sun), matches DAYS_JP order
function toWeekdayIndex(d: Date): number {
  const jsDay = d.getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

function mondayOf(d: Date): Date {
  const idx = toWeekdayIndex(d)
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  m.setDate(m.getDate() - idx)
  m.setHours(0, 0, 0, 0)
  return m
}

function addDays(d: Date, days: number): Date {
  const n = new Date(d)
  n.setDate(n.getDate() + days)
  return n
}

function roundTss(v: number): number {
  return Math.max(0, Math.round(v / 5) * 5)
}

/**
 * Builds the week-by-week periodization skeleton from today through the event week.
 * Deterministic — no AI involved. Day-level detail is filled in later per-week.
 */
export function computeWeekSchedule(params: {
  today: Date
  eventDate: Date
  weeklyTargetTss: number
  restDayIndices: number[]
  ftpTestEnabled?: boolean
}): WeekPlan[] {
  const { today, eventDate, weeklyTargetTss, restDayIndices, ftpTestEnabled = true } = params
  const startMonday = mondayOf(today)
  const eventMonday = mondayOf(eventDate)
  const totalWeeks = Math.max(1, Math.round((eventMonday.getTime() - startMonday.getTime()) / (7 * 86400000)) + 1)

  let phases: Phase[]
  if (totalWeeks === 1) {
    phases = ['Taper']
  } else if (totalWeeks === 2) {
    phases = ['Peak', 'Taper']
  } else {
    const taperWeeks = totalWeeks >= 8 ? 2 : totalWeeks >= 4 ? 1 : 0
    const afterTaper = totalWeeks - taperWeeks
    const peakWeeks = afterTaper > 0 ? Math.max(1, Math.round(afterTaper * 0.15)) : 0
    const afterPeak = afterTaper - peakWeeks
    const buildWeeks = afterPeak > 0 ? Math.round(afterPeak * 0.45) : 0
    const baseWeeks = Math.max(0, afterPeak - buildWeeks)
    phases = [
      ...Array(baseWeeks).fill('Base' as Phase),
      ...Array(buildWeeks).fill('Build' as Phase),
      ...Array(peakWeeks).fill('Peak' as Phase),
      ...Array(taperWeeks).fill('Taper' as Phase),
    ]
  }

  // phase-relative index for TSS ramp calculation
  const phaseLengths: Record<Phase, number> = { Base: 0, Build: 0, Peak: 0, Taper: 0 }
  for (const p of phases) phaseLengths[p]++
  const phaseSeen: Record<Phase, number> = { Base: 0, Build: 0, Peak: 0, Taper: 0 }

  const weeks: WeekPlan[] = []
  let lastFtpTestWeekIndex = -Infinity

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i]
    const L = phaseLengths[phase]
    const iIn = phaseSeen[phase]
    phaseSeen[phase]++
    const frac = L <= 1 ? 1 : iIn / (L - 1)

    let tss: number
    if (phase === 'Base') tss = weeklyTargetTss * (0.55 + 0.2 * frac)
    else if (phase === 'Build') tss = weeklyTargetTss * (0.75 + 0.25 * frac)
    else if (phase === 'Peak') tss = weeklyTargetTss * (0.95 + 0.1 * frac)
    else tss = L <= 1 ? weeklyTargetTss * 0.45 : iIn === 0 ? weeklyTargetTss * 0.6 : weeklyTargetTss * 0.3

    const isRecoveryWeek = (phase === 'Base' || phase === 'Build') && (iIn + 1) % 4 === 0
    const isTaper = phase === 'Taper'

    let weekRestDays = [...restDayIndices]
    if (isRecoveryWeek || isTaper) {
      const trainingDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !weekRestDays.includes(d))
      const extraRest = trainingDays[trainingDays.length - 1]
      if (extraRest !== undefined) weekRestDays = [...weekRestDays, extraRest]
      tss *= 0.7
    }

    let hasFtpTest = false
    let ftpTestDay: number | null = null
    if (ftpTestEnabled && isRecoveryWeek && i - lastFtpTestWeekIndex >= 3) {
      const trainingDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !weekRestDays.includes(d))
      if (trainingDays.length > 0) {
        hasFtpTest = true
        ftpTestDay = Math.min(...trainingDays)
        lastFtpTestWeekIndex = i
      }
    }

    weeks.push({
      weekNumber: i + 1,
      weekStartDate: addDays(startMonday, i * 7),
      phase,
      isRecoveryWeek,
      hasFtpTest,
      ftpTestDay,
      targetTss: roundTss(tss),
      restDayIndices: weekRestDays.sort((a, b) => a - b),
    })
  }

  return weeks
}

/**
 * Repeating schedule for goals with no target date (general fitness, climbing,
 * criteriums, etc.): a 4-week cycle of 3 progressively-loaded "Build" weeks
 * followed by one recovery ("Base") week, repeated indefinitely. Generated
 * one block at a time (see ONGOING_BLOCK_SIZE) and extended as the athlete
 * gets close to running out of scheduled weeks — see extendOngoingPlan.
 */
export function computeOngoingBlock(params: {
  startWeekNumber: number
  blockStartDate: Date
  weeksToGenerate: number
  weeklyTargetTss: number
  restDayIndices: number[]
  ftpTestEnabled: boolean
  tssMultiplier?: number
  lastFtpTestWeekIndex?: number
}): WeekPlan[] {
  const {
    startWeekNumber,
    blockStartDate,
    weeksToGenerate,
    weeklyTargetTss,
    restDayIndices,
    ftpTestEnabled,
    tssMultiplier = 1,
    lastFtpTestWeekIndex = -Infinity,
  } = params
  const startMonday = mondayOf(blockStartDate)

  const weeks: WeekPlan[] = []
  let lastFtp = lastFtpTestWeekIndex

  for (let i = 0; i < weeksToGenerate; i++) {
    const absoluteIndex = startWeekNumber - 1 + i // 0-based, counted from the very first week of the plan
    const cyclePos = absoluteIndex % 4 // 0,1,2 = build load weeks, 3 = recovery week
    const isRecoveryWeek = cyclePos === 3
    const phase: Phase = isRecoveryWeek ? 'Base' : 'Build'

    let tss = (isRecoveryWeek ? weeklyTargetTss * 0.65 : weeklyTargetTss * (0.85 + 0.1 * cyclePos)) * tssMultiplier

    let weekRestDays = [...restDayIndices]
    if (isRecoveryWeek) {
      const trainingDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !weekRestDays.includes(d))
      const extraRest = trainingDays[trainingDays.length - 1]
      if (extraRest !== undefined) weekRestDays = [...weekRestDays, extraRest]
    }

    let hasFtpTest = false
    let ftpTestDay: number | null = null
    if (ftpTestEnabled && isRecoveryWeek && absoluteIndex - lastFtp >= 3) {
      const trainingDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !weekRestDays.includes(d))
      if (trainingDays.length > 0) {
        hasFtpTest = true
        ftpTestDay = Math.min(...trainingDays)
        lastFtp = absoluteIndex
      }
    }

    weeks.push({
      weekNumber: startWeekNumber + i,
      weekStartDate: addDays(startMonday, i * 7),
      phase,
      isRecoveryWeek,
      hasFtpTest,
      ftpTestDay,
      targetTss: roundTss(tss),
      restDayIndices: weekRestDays.sort((a, b) => a - b),
    })
  }

  return weeks
}

/** Pure preview of a week's day types, before AI detail generation fills in workouts. */
export function computeDayTypes(week: WeekPlan): PlanDayDraft[] {
  return [0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => ({
    date: addDays(week.weekStartDate, dayOfWeek),
    dayOfWeek,
    type: week.hasFtpTest && week.ftpTestDay === dayOfWeek
      ? 'ftp_test'
      : week.restDayIndices.includes(dayOfWeek)
        ? 'rest'
        : 'workout',
  }))
}

export function formatDateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parses a Postgres `date` column ("YYYY-MM-DD") as a local-midnight Date, avoiding UTC-shift bugs. */
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const toDateStr = formatDateOnly

export async function getActivePlan(): Promise<{ plan: TrainingPlanRow; weeks: PlanWeekRow[] } | null> {
  const { data: plan } = await supabase
    .from('training_plan')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!plan) return null
  const { data: weeks } = await supabase
    .from('plan_week')
    .select('*')
    .eq('plan_id', plan.id)
    .order('week_number', { ascending: true })
  return { plan, weeks: weeks || [] }
}

/** トレーニング内容はそのままに、プランの目標名（表示ラベル）だけを更新する。 */
export async function updatePlanGoalName(planId: string, eventName: string): Promise<void> {
  await supabase.from('training_plan').update({ event_name: eventName }).eq('id', planId)
}

export async function createTrainingPlan(input: {
  eventName: string
  eventDate: Date | null
  startDate: Date
  startingFtp: number
  goalFtp: number
  weeklyTargetTss: number
  platform: string
  restDayIndices: number[]
  goalType: GoalType
  ftpTestEnabled: boolean
}): Promise<{ plan: TrainingPlanRow; weeks: PlanWeekRow[] }> {
  await supabase.from('training_plan').update({ status: 'archived' }).eq('status', 'active')

  const { data: plan, error: planError } = await supabase
    .from('training_plan')
    .insert({
      event_name: input.eventName,
      event_date: input.eventDate ? toDateStr(input.eventDate) : null,
      start_date: toDateStr(input.startDate),
      starting_ftp: input.startingFtp,
      goal_ftp: input.goalFtp,
      weekly_target_tss: input.weeklyTargetTss,
      platform: input.platform,
      rest_day_indices: input.restDayIndices,
      status: 'active',
      goal_type: input.goalType,
      ftp_test_enabled: input.ftpTestEnabled,
    })
    .select()
    .single()
  if (planError || !plan) throw planError || new Error('failed to create plan')

  const schedule =
    input.goalType === 'race' && input.eventDate
      ? computeWeekSchedule({
          today: input.startDate,
          eventDate: input.eventDate,
          weeklyTargetTss: input.weeklyTargetTss,
          restDayIndices: input.restDayIndices,
          ftpTestEnabled: input.ftpTestEnabled,
        })
      : computeOngoingBlock({
          startWeekNumber: 1,
          blockStartDate: input.startDate,
          weeksToGenerate: ONGOING_BLOCK_SIZE,
          weeklyTargetTss: input.weeklyTargetTss,
          restDayIndices: input.restDayIndices,
          ftpTestEnabled: input.ftpTestEnabled,
        })

  const { data: weeks, error: weeksError } = await supabase
    .from('plan_week')
    .insert(
      schedule.map(w => ({
        plan_id: plan.id,
        week_number: w.weekNumber,
        week_start_date: toDateStr(w.weekStartDate),
        phase: w.phase,
        is_recovery_week: w.isRecoveryWeek,
        has_ftp_test: w.hasFtpTest,
        ftp_test_day: w.ftpTestDay,
        target_tss: w.targetTss,
        rest_day_indices: w.restDayIndices,
        detail_status: 'pending',
      }))
    )
    .select()
  if (weeksError) throw weeksError

  return { plan, weeks: (weeks || []).sort((a: PlanWeekRow, b: PlanWeekRow) => a.week_number - b.week_number) }
}

/**
 * Appends the next block of weeks to an ongoing (date-less) plan, continuing
 * the repeating cycle from where it left off. tssMultiplier (<1 to ease off,
 * >1 to push harder) applies only to the new block, so it works as a
 * check-in adjustment rather than a permanent plan-wide change.
 */
export async function extendOngoingPlan(
  plan: TrainingPlanRow,
  lastWeek: PlanWeekRow,
  tssMultiplier: number = 1
): Promise<PlanWeekRow[]> {
  const { data: recentFtpWeeks } = await supabase
    .from('plan_week')
    .select('week_number')
    .eq('plan_id', plan.id)
    .eq('has_ftp_test', true)
    .order('week_number', { ascending: false })
    .limit(1)
  const lastFtpTestWeekIndex = recentFtpWeeks && recentFtpWeeks.length > 0 ? recentFtpWeeks[0].week_number - 1 : -Infinity

  const schedule = computeOngoingBlock({
    startWeekNumber: lastWeek.week_number + 1,
    blockStartDate: addDays(parseDateOnly(lastWeek.week_start_date), 7),
    weeksToGenerate: ONGOING_BLOCK_SIZE,
    weeklyTargetTss: plan.weekly_target_tss,
    restDayIndices: plan.rest_day_indices,
    ftpTestEnabled: plan.ftp_test_enabled,
    tssMultiplier,
    lastFtpTestWeekIndex,
  })

  const { data: weeks, error } = await supabase
    .from('plan_week')
    .insert(
      schedule.map(w => ({
        plan_id: plan.id,
        week_number: w.weekNumber,
        week_start_date: toDateStr(w.weekStartDate),
        phase: w.phase,
        is_recovery_week: w.isRecoveryWeek,
        has_ftp_test: w.hasFtpTest,
        ftp_test_day: w.ftpTestDay,
        target_tss: w.targetTss,
        rest_day_indices: w.restDayIndices,
        detail_status: 'pending',
      }))
    )
    .select()
  if (error) throw error
  return (weeks || []).sort((a: PlanWeekRow, b: PlanWeekRow) => a.week_number - b.week_number)
}

export async function getPlanDays(weekId: string): Promise<PlanDayRow[]> {
  const { data } = await supabase.from('plan_day').select('*').eq('plan_week_id', weekId).order('date', { ascending: true })
  return data || []
}

/**
 * Changes which weekdays are rest days for one already-created week.
 * Existing day-level detail no longer matches the new rest pattern, so it's
 * cleared and the week is marked pending again — the caller regenerates it
 * the same way a freshly-scheduled week gets its detail generated.
 */
export async function updateWeekRestDays(weekId: string, restDayIndices: number[]): Promise<void> {
  const { error: deleteError } = await supabase.from('plan_day').delete().eq('plan_week_id', weekId)
  if (deleteError) throw deleteError
  const { error: updateError } = await supabase
    .from('plan_week')
    .update({ rest_day_indices: [...restDayIndices].sort((a, b) => a - b), detail_status: 'pending' })
    .eq('id', weekId)
  if (updateError) throw updateError
}

export async function saveGeneratedWeekDays(
  weekId: string,
  days: {
    date: Date
    dayOfWeek: number
    type: DayType
    platform?: string | null
    name?: string | null
    duration?: number | null
    plannedTss?: number | null
    zone?: string | null
    description?: string | null
  }[]
): Promise<void> {
  const { error: insertError } = await supabase.from('plan_day').insert(
    days.map(d => ({
      plan_week_id: weekId,
      date: toDateStr(d.date),
      day_of_week: d.dayOfWeek,
      type: d.type,
      platform: d.platform ?? null,
      name: d.name ?? null,
      duration: d.duration ?? null,
      planned_tss: d.plannedTss ?? null,
      zone: d.zone ?? null,
      description: d.description ?? null,
    }))
  )
  if (insertError) throw insertError

  const { error: updateError } = await supabase.from('plan_week').update({ detail_status: 'generated' }).eq('id', weekId)
  if (updateError) throw updateError
}

export async function updatePlanDayReview(
  dayId: string,
  fields: Partial<
    Pick<
      PlanDayRow,
      'strava_activity_id' | 'actual_tss' | 'actual_duration' | 'achievement_pct' | 'review_status' | 'review_comment'
    >
  >
): Promise<void> {
  await supabase.from('plan_day').update(fields).eq('id', dayId)
}

/** ワークアウトが予定されていた日を、休養日として上書きする（未実施の圧を感じさせないため）。 */
export async function markDayAsRest(dayId: string): Promise<void> {
  await supabase.from('plan_day').update({
    type: 'rest',
    platform: null,
    name: null,
    duration: null,
    planned_tss: null,
    zone: null,
    description: null,
    strava_activity_id: null,
    actual_tss: null,
    actual_duration: null,
    achievement_pct: null,
    review_status: 'rest_ok',
    review_comment: null,
  }).eq('id', dayId)
}

export interface DayReviewResult {
  reviewStatus: ReviewStatus
  actualTss: number | null
  actualDuration: number | null
  achievementPct: number | null
  stravaActivityId: number | null
}

/** Rule-based planned-vs-actual comparison for one day, given the Strava activities on that date. */
export function classifyDayReview(day: PlanDayRow, activities: StravaActivity[], ftp: number): DayReviewResult {
  if (activities.length === 0) {
    return {
      reviewStatus: day.type === 'rest' ? 'rest_ok' : 'not_done',
      actualTss: null,
      actualDuration: null,
      achievementPct: null,
      stravaActivityId: null,
    }
  }

  const totalTss = activities.reduce((s, a) => s + computeActivityTss(a, ftp), 0)
  const totalDuration = Math.round(activities.reduce((s, a) => s + a.moving_time, 0) / 60)
  const representative = activities.reduce((best, a) => (computeActivityTss(a, ftp) > computeActivityTss(best, ftp) ? a : best))

  if (day.type === 'rest') {
    return {
      reviewStatus: totalTss > 30 ? 'rest_skipped' : 'rest_ok',
      actualTss: totalTss,
      actualDuration: totalDuration,
      achievementPct: null,
      stravaActivityId: representative.id,
    }
  }

  const plannedTss = day.planned_tss || 0
  const pct = plannedTss > 0 ? Math.round((totalTss / plannedTss) * 100) : null
  const reviewStatus: ReviewStatus = pct === null ? 'completed' : pct >= 85 ? 'completed' : pct >= 50 ? 'partial' : 'not_done'

  return {
    reviewStatus,
    actualTss: totalTss,
    actualDuration: totalDuration,
    achievementPct: pct,
    stravaActivityId: representative.id,
  }
}
