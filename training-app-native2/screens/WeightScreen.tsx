import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import Svg, { Polyline, Line, Circle, Defs, LinearGradient, Stop, Polygon, Text as SvgText, G } from 'react-native-svg'
import DateTimePicker from '@react-native-community/datetimepicker'
import { requestHealthKitAuthorization, getMostRecentWeightSample, saveWeightSample } from '../lib/healthkit'
import { supabase } from '../lib/supabase'
import { C, styles } from '../lib/theme'

export default function WeightScreen({ goalWeight }: { goalWeight: number }) {
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
      await saveWeightSample(value, d)
    } catch {}
  }

  async function syncFromHealthKit() {
    setHealthSyncing(true)
    setHealthMsg('')
    try {
      await requestHealthKitAuthorization({
        toRead: ['HKQuantityTypeIdentifierBodyMass'],
        toShare: ['HKQuantityTypeIdentifierBodyMass'],
      })
      const sample = await getMostRecentWeightSample()
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
    setLog((data ?? []).map((d: any) => ({
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
        const minW = Math.min(...log.map(d => d.w), goalWeight) - 1
        const maxW = Math.max(...log.map(d => d.w), goalWeight) + 1
        const range = maxW - minW
        const W = 320
        const H = 110
        const padLeft = 30
        const plotW = W - padLeft
        const yForW = (w: number) => ((maxW - w) / range) * (H - 10) + 5
        const pts = log.map((d, i) => ({
          x: padLeft + (i / (log.length - 1)) * plotW,
          y: yForW(d.w),
        }))
        const polyPoints = pts.map(p => `${p.x},${p.y}`).join(' ')
        const areaPoints = [
          ...pts.map(p => `${p.x},${p.y}`),
          `${padLeft + plotW},${H}`, `${padLeft},${H}`
        ].join(' ')
        const goalY = yForW(goalWeight)
        const goalLabelBelow = goalY < 15
        const yTicks = [maxW, minW + range / 2, minW]

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
              {yTicks.map((v, i) => {
                const y = yForW(v)
                return (
                  <G key={i}>
                    <Line x1={padLeft} y1={y} x2={padLeft + plotW} y2={y} stroke={C.border} strokeWidth={1} />
                    <SvgText x={padLeft - 4} y={y + 3} fill={C.muted} fontSize={8} textAnchor="end">
                      {v.toFixed(1)}
                    </SvgText>
                  </G>
                )
              })}
              <Polygon points={areaPoints} fill="url(#wgrad)" />
              <Polyline points={polyPoints} fill="none" stroke={C.cyan} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              <Line x1={padLeft} y1={goalY} x2={padLeft + plotW} y2={goalY} stroke={C.green} strokeWidth={1} strokeDasharray="4,3" />
              <SvgText
                x={padLeft + plotW}
                y={goalLabelBelow ? goalY + 11 : goalY - 4}
                fill={C.green}
                fontSize={9}
                fontWeight="bold"
                textAnchor="end"
              >
                {`目標 ${goalWeight}kg`}
              </SvgText>
              {pts.map((p, i) => (
                <Circle key={i} cx={p.x} cy={p.y} r={4} fill={C.bg} stroke={C.cyan} strokeWidth={2} />
              ))}
            </Svg>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginLeft: `${(padLeft / W) * 100}%` }}>
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
