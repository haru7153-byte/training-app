import { StyleSheet } from 'react-native'
import { Phase, ReviewStatus, PlanWeekRow, TrainingPlanRow } from './plan'

export const C = {
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

export const TABS = [
  { id: 'home',   label: 'ホーム',  icon: '⚡' },
  { id: 'plan',   label: 'プラン',  icon: '📅' },
  { id: 'strava', label: 'Strava', icon: '🚴' },
  { id: 'weight', label: '体重',    icon: '⚖️' },
  { id: 'goals',  label: '目標',    icon: '🎯' },
]

export const PHASE_COLORS: Record<Phase, string> = { Base: C.green, Build: C.orange, Peak: C.red, Taper: C.cyan }

/**
 * 日付のない（進行中の）目標のプランは Base/Build の2フェーズを繰り返すだけなので、
 * PHASE_COLORS だけだとほとんどの週が同じ色（オレンジ）になってしまう。
 * その週のTSSが基準値に対してどれくらいの強度かで色分けする。
 */
export function weekColor(week: PlanWeekRow, plan: TrainingPlanRow): string {
  if (plan.goal_type !== 'ongoing') return PHASE_COLORS[week.phase]
  if (week.is_recovery_week) return C.cyan
  const ratio = plan.weekly_target_tss > 0 ? week.target_tss / plan.weekly_target_tss : 1
  if (ratio < 0.9) return C.blue
  if (ratio < 1.0) return C.green
  return C.orange
}

export const REVIEW_LABELS: Record<ReviewStatus, { label: string; color: string }> = {
  pending:      { label: '未評価',           color: C.muted },
  completed:    { label: '✅ 達成',           color: C.green },
  partial:      { label: '🟡 部分達成',       color: C.orange },
  not_done:     { label: '😌 レスト日扱い',    color: C.muted },
  rest_ok:      { label: '😴 休養OK',         color: C.muted },
  rest_skipped: { label: '🚴 レスト日に運動あり', color: C.blue },
}

export const ZONE_COLORS: Record<string, string> = {
  Recovery: C.muted,
  Endurance: C.blue,
  Tempo: C.green,
  'Sweet Spot': '#EAB308',
  Threshold: C.orange,
  VO2max: C.red,
  Anaerobic: C.purple,
  Mixed: C.cyan,
}

export const styles = StyleSheet.create({
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
