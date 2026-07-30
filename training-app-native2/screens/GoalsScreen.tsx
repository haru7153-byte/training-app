import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Switch } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import { GoalType, TrainingFocus } from '../lib/plan'
import { loadNotificationSettings, applyNotificationSettings, NotificationSettings } from '../lib/notifications'
import { getEntitlementInfo, EntitlementInfo } from '../lib/entitlements'
import { isPurchasesConfigured, getCurrentOffering, purchasePackage, restorePurchases } from '../lib/purchases'
import type { PurchasesOffering } from 'react-native-purchases'
import { C, styles } from '../lib/theme'

type TssTier = 'light' | 'standard' | 'hard'

const ONGOING_GOAL_PRESETS: { label: string; icon: string; focus: TrainingFocus; tssTier: TssTier }[] = [
  { label: '体力づくり', icon: '🚴', focus: 'balanced', tssTier: 'light' },
  { label: '坂をもっと楽に登れるようになりたい', icon: '⛰️', focus: 'climbing', tssTier: 'standard' },
  { label: 'クリテリウムで勝ちたい', icon: '🏁', focus: 'criterium', tssTier: 'standard' },
]

const TSS_PRESETS: { label: string; desc: string; value: number; tier: TssTier; color: string }[] = [
  { label: 'ライト', desc: '楽に、余裕を持って', value: 280, tier: 'light', color: C.green },
  { label: '標準', desc: 'ほどよく追い込む', value: 400, tier: 'standard', color: C.blue },
  { label: 'しっかり', desc: 'しっかり追い込む', value: 520, tier: 'hard', color: C.orange },
]

export default function GoalsScreen({ ftp, onGoalsChange, onFtpUpdate }: {
  ftp: number
  onGoalsChange: (g: {
    targetFtp: number; targetTSS: number; eventName: string; targetWeight: number
    goalType: GoalType; eventDate: Date | null; ftpTestEnabled: boolean; trainingFocus: TrainingFocus
  }) => void
  onFtpUpdate: (ftp: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ftpInput, setFtpInput] = useState('')
  const [ftpSaving, setFtpSaving] = useState(false)
  const [ftpMsg, setFtpMsg] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [currentWeight, setCurrentWeight] = useState<number | null>(null)
  const [startWeight, setStartWeight] = useState<number | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTssInput, setShowTssInput] = useState(false)
  const [showGoalDropdown, setShowGoalDropdown] = useState(false)

  const [targetFtp, setTargetFtp] = useState('320')
  const [targetWeight, setTargetWeight] = useState('70.0')
  const [targetTSS, setTargetTSS] = useState('420')
  const [eventName, setEventName] = useState('グランフォンドKyoto')
  const [eventDate, setEventDate] = useState(new Date('2025-10-15'))
  const [hasTargetRace, setHasTargetRace] = useState(true)
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocus>('balanced')
  const [ftpTestEnabled, setFtpTestEnabled] = useState(true)
  const [goalPresetIndex, setGoalPresetIndex] = useState(0) // -1 = その他（自由入力）
  const [tssAutoTier, setTssAutoTier] = useState<TssTier | null>(null)

  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifHour, setNotifHour] = useState(20)
  const [notifMinute, setNotifMinute] = useState(0)
  const [showNotifTimePicker, setShowNotifTimePicker] = useState(false)
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifMsg, setNotifMsg] = useState('')

  useEffect(() => {
    loadNotificationSettings().then(s => {
      setNotifEnabled(s.enabled)
      setNotifHour(s.hour)
      setNotifMinute(s.minute)
    })
  }, [])

  async function updateNotifSettings(next: NotificationSettings) {
    setNotifSaving(true)
    setNotifMsg('')
    const result = await applyNotificationSettings(next)
    if (result.ok) {
      setNotifEnabled(next.enabled)
      setNotifHour(next.hour)
      setNotifMinute(next.minute)
    } else {
      setNotifEnabled(false)
      setNotifMsg(
        result.reason === 'unavailable'
          ? '⚠️ このビルドには通知機能がまだ含まれていません。次のアップデートをお待ちください。'
          : '⚠️ 通知が許可されていません。端末の設定アプリからこのアプリの通知を許可してください。'
      )
    }
    setNotifSaving(false)
  }

  const [entitlement, setEntitlement] = useState<EntitlementInfo | null>(null)
  const [offering, setOffering] = useState<PurchasesOffering | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [subMsg, setSubMsg] = useState('')

  useEffect(() => {
    refreshEntitlement()
    getCurrentOffering().then(setOffering)
  }, [])

  function refreshEntitlement() {
    getEntitlementInfo().then(setEntitlement)
  }

  async function handleSubscribe() {
    const pkg = offering?.availablePackages[0]
    if (!pkg) return
    setSubscribing(true)
    setSubMsg('')
    const result = await purchasePackage(pkg)
    if (result.ok) {
      setSubMsg('✅ 購読処理が完了しました。反映まで少し時間がかかることがあります。')
      setTimeout(refreshEntitlement, 3000)
    } else if (result.error !== 'cancelled') {
      setSubMsg('❌ 購読処理に失敗しました。もう一度お試しください。')
    }
    setSubscribing(false)
  }

  async function handleRestore() {
    setSubscribing(true)
    setSubMsg('')
    const result = await restorePurchases()
    if (result.ok) {
      setSubMsg('✅ 購入を復元しました。')
      setTimeout(refreshEntitlement, 2000)
    } else {
      setSubMsg('復元できる購入が見つかりませんでした。')
    }
    setSubscribing(false)
  }

  function selectGoalPreset(idx: number) {
    setShowGoalDropdown(false)
    setGoalPresetIndex(idx)
    if (idx === -1) {
      setEventName('')
      setTrainingFocus('balanced')
      setTssAutoTier(null)
    } else {
      const preset = ONGOING_GOAL_PRESETS[idx]
      setEventName(preset.label)
      setTrainingFocus(preset.focus)
      const tssPreset = TSS_PRESETS.find(p => p.tier === preset.tssTier)
      if (tssPreset) {
        setTargetTSS(String(tssPreset.value))
        setShowTssInput(false)
        setTssAutoTier(preset.tssTier)
      }
    }
  }

  function selectTssPreset(tier: TssTier, value: number) {
    setTargetTSS(String(value))
    setShowTssInput(false)
    setTssAutoTier(null)
  }

  // レースなしに切り替えた時、ドロップダウンの選択状態を今のeventNameに合わせて同期する
  // （eventNameはレース名/継続目標ラベルを共用しているため、レース→継続の切り替え直後にズレないように）
  useEffect(() => {
    if (!hasTargetRace) {
      setGoalPresetIndex(ONGOING_GOAL_PRESETS.findIndex(p => p.label === eventName))
    } else {
      setTssAutoTier(null)
    }
  }, [hasTargetRace])

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
    setHasTargetRace(g.goalType !== 'ongoing')
    setFtpTestEnabled(g.ftpTestEnabled !== undefined ? !!g.ftpTestEnabled : true)
    setTrainingFocus(g.trainingFocus === 'climbing' || g.trainingFocus === 'criterium' ? g.trainingFocus : 'balanced')
    const idx = ONGOING_GOAL_PRESETS.findIndex(p => p.label === g.eventName)
    setGoalPresetIndex(idx)
  }

  async function saveGoals() {
    setSaving(true)
    const goalType: GoalType = hasTargetRace ? 'race' : 'ongoing'
    const focus: TrainingFocus = hasTargetRace ? 'balanced' : trainingFocus
    await AsyncStorage.setItem('user_goals', JSON.stringify({
      targetFtp, targetWeight, targetTSS, eventName,
      eventDate: eventDate.toISOString(),
      goalType, ftpTestEnabled, trainingFocus: focus,
    }))
    onGoalsChange({
      targetFtp: parseInt(targetFtp) || 320,
      targetTSS: parseInt(targetTSS) || 420,
      eventName,
      targetWeight: parseFloat(targetWeight) || 70,
      goalType,
      eventDate: hasTargetRace ? eventDate : null,
      ftpTestEnabled,
      trainingFocus: focus,
    })
    setSaving(false)
    setEditing(false)
    setSaveMsg('✅ 保存しました。プラン画面を開くと、今の内容で作り直す準備ができています。')
    setTimeout(() => setSaveMsg(''), 6000)
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

  const daysToEvent = hasTargetRace ? Math.max(0, Math.ceil((eventDate.getTime() - Date.now()) / 86400000)) : null
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

      {/* イベント/目標カード */}
      <View style={[styles.banner, { flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerLabel, { color: C.orange }]}>{hasTargetRace ? '🎯 目標イベント' : '🎯 目標'}</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, marginTop: 6 }}>{eventName}</Text>
          <Text style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
            {hasTargetRace
              ? eventDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
              : '日付を区切らず、継続的に取り組む目標です'}
          </Text>
        </View>
        {hasTargetRace && (
          <View style={{ alignItems: 'center', backgroundColor: C.orange + '22', borderRadius: 16, padding: 16, minWidth: 72 }}>
            <Text style={{ fontSize: 34, fontWeight: '900', color: C.orange, lineHeight: 40 }}>{daysToEvent}</Text>
            <Text style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>日後</Text>
          </View>
        )}
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

      {saveMsg !== '' && (
        <View style={{ backgroundColor: C.green + '18', borderWidth: 1, borderColor: C.green + '40', borderRadius: 12, padding: 12 }}>
          <Text style={{ fontSize: 12, color: C.text, lineHeight: 17 }}>{saveMsg}</Text>
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

          <Text style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>目標としているレース・イベントがある？</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {[{ v: true, l: 'ある', c: C.blue }, { v: false, l: 'ない', c: C.purple }].map(o => (
              <TouchableOpacity
                key={String(o.v)}
                onPress={() => setHasTargetRace(o.v)}
                style={{
                  flex: 1, padding: 10, borderRadius: 10, alignItems: 'center',
                  backgroundColor: hasTargetRace === o.v ? o.c : C.surface,
                  borderWidth: 1, borderColor: hasTargetRace === o.v ? o.c : C.border,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: hasTargetRace === o.v ? '#fff' : C.sub }}>{o.l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {hasTargetRace ? (
            <>
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
            </>
          ) : (
            <>
              <Text style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>目標</Text>
              <View style={{ marginBottom: showGoalDropdown ? 4 : 8 }}>
                <TouchableOpacity
                  onPress={() => setShowGoalDropdown(v => !v)}
                  style={{
                    backgroundColor: C.surface, borderWidth: 1, borderColor: showGoalDropdown ? C.purple : C.border,
                    borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>
                    {goalPresetIndex >= 0 ? `${ONGOING_GOAL_PRESETS[goalPresetIndex].icon} ${ONGOING_GOAL_PRESETS[goalPresetIndex].label}` : '✏️ その他（自由入力）'}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 11 }}>{showGoalDropdown ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {showGoalDropdown && (
                  <View style={{ backgroundColor: '#16202F', borderWidth: 1, borderColor: C.border, borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
                    {ONGOING_GOAL_PRESETS.map((preset, i) => (
                      <TouchableOpacity
                        key={preset.label}
                        onPress={() => selectGoalPreset(i)}
                        style={{
                          padding: 12, borderBottomWidth: 1, borderBottomColor: C.border,
                          backgroundColor: goalPresetIndex === i ? C.purple : 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: goalPresetIndex === i ? '#fff' : C.sub }}>
                          {preset.icon} {preset.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      onPress={() => selectGoalPreset(-1)}
                      style={{ padding: 12, backgroundColor: goalPresetIndex === -1 ? C.purple : 'transparent' }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: goalPresetIndex === -1 ? '#fff' : C.sub }}>✏️ その他（自由入力）</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {goalPresetIndex === -1 && (
                <TextInput
                  style={[styles.input, { marginBottom: 8 }]}
                  value={eventName}
                  onChangeText={setEventName}
                  placeholder="目標を入力（例: 体力づくり）"
                  placeholderTextColor={C.muted}
                />
              )}
              <Text style={{ fontSize: 10, color: C.muted, marginBottom: 12, lineHeight: 15 }}>
                {goalPresetIndex >= 0
                  ? '練習内容とTSSの目安は、この目標に合わせて自動で決まります（TSSは下で変更できます）。'
                  : '自由入力した場合、練習内容は標準的な内容になります。'}
              </Text>
            </>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>長期プランにFTPテスト週を入れる</Text>
            <Switch
              value={ftpTestEnabled}
              onValueChange={setFtpTestEnabled}
              trackColor={{ false: C.border, true: C.green }}
              thumbColor="#fff"
            />
          </View>
          <Text style={{ fontSize: 10, color: C.muted, marginBottom: 14, lineHeight: 15 }}>
            オンにすると、約3週おきにFTPテスト週を自動で組み込みます
          </Text>

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

          <Text style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>どれくらいの強度でトレーニングしたいですか？</Text>
          {tssAutoTier && (
            <Text style={{ fontSize: 10, color: C.muted, marginBottom: 6, lineHeight: 14 }}>
              「{eventName}」向けに<Text style={{ color: TSS_PRESETS.find(p => p.tier === tssAutoTier)!.color, fontWeight: '700' }}>{TSS_PRESETS.find(p => p.tier === tssAutoTier)!.label}</Text>を自動選択しました
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {TSS_PRESETS.map(p => {
              const selected = targetTSS === String(p.value)
              return (
                <TouchableOpacity
                  key={p.label}
                  onPress={() => selectTssPreset(p.tier, p.value)}
                  style={{
                    flex: 1, padding: 8, borderRadius: 10, alignItems: 'center',
                    backgroundColor: selected ? p.color : C.surface,
                    borderWidth: 1, borderColor: selected ? p.color : C.border,
                  }}
                >
                  {tssAutoTier === p.tier && (
                    <View style={{ position: 'absolute', top: -6, right: -4, backgroundColor: C.cyan, borderRadius: 99, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 8, fontWeight: '800', color: '#08202A' }}>自動</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: selected ? '#fff' : C.sub }}>{p.label}</Text>
                  <Text style={{ fontSize: 9, color: selected ? 'rgba(255,255,255,0.85)' : C.muted, marginTop: 2, textAlign: 'center' }}>{p.desc}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
          {!showTssInput ? (
            <TouchableOpacity onPress={() => setShowTssInput(true)} style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 11, color: C.blue, fontWeight: '700' }}>TSSの数値を直接指定する（現在: {targetTSS}）</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>週間目標TSS（数値）</Text>
              <TextInput style={[styles.input, { marginBottom: 16 }]} value={targetTSS} onChangeText={setTargetTSS} keyboardType="numeric" placeholderTextColor={C.muted} />
            </>
          )}

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

      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.sectionTitle}>🔔 通知</Text>
            <Text style={{ fontSize: 12, color: C.sub, marginTop: -6 }}>毎日決まった時間にリマインドします</Text>
          </View>
          <Switch
            value={notifEnabled}
            disabled={notifSaving}
            onValueChange={v => updateNotifSettings({ enabled: v, hour: notifHour, minute: notifMinute })}
            trackColor={{ false: C.border, true: C.blue }}
            thumbColor="#fff"
          />
        </View>

        {notifEnabled && (
          <>
            <TouchableOpacity
              onPress={() => setShowNotifTimePicker(v => !v)}
              style={{
                marginTop: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: showNotifTimePicker ? C.blue : C.border,
                borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: C.text, fontSize: 14 }}>
                🕐 {String(notifHour).padStart(2, '0')}:{String(notifMinute).padStart(2, '0')}
              </Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>{showNotifTimePicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showNotifTimePicker && (
              <>
                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, overflow: 'hidden', marginTop: 8 }}>
                  <DateTimePicker
                    value={(() => { const d = new Date(); d.setHours(notifHour, notifMinute, 0, 0); return d })()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    locale="ja-JP"
                    themeVariant="light"
                    onChange={(_, date) => {
                      if (Platform.OS === 'android') setShowNotifTimePicker(false)
                      if (date) updateNotifSettings({ enabled: true, hour: date.getHours(), minute: date.getMinutes() })
                    }}
                  />
                </View>
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    onPress={() => setShowNotifTimePicker(false)}
                    style={{ backgroundColor: C.blue, borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 8 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>完了</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </>
        )}

        {notifMsg !== '' && <Text style={{ fontSize: 12, color: C.orange, marginTop: 10, lineHeight: 16 }}>{notifMsg}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>💳 プラン</Text>
        <Text style={{ fontSize: 12, color: C.sub, marginTop: -6, marginBottom: 12, lineHeight: 16 }}>
          プラン・体重記録・Strava連携などの基本機能はずっと無料です。AI機能（プラン自動生成・週次/日次分析）だけ、サインアップから30日間の無料期間のあと購読が必要になります。
        </Text>

        {!entitlement ? (
          <Text style={{ fontSize: 12, color: C.muted }}>読み込み中...</Text>
        ) : entitlement.subscribed ? (
          <Text style={{ fontSize: 14, fontWeight: '800', color: C.green }}>✅ AI機能 購読中</Text>
        ) : entitlement.trialActive ? (
          <View>
            <Text style={{ fontSize: 13, color: C.text }}>AI機能は無料体験期間中です</Text>
            <Text style={{ fontSize: 24, fontWeight: '900', color: C.blue, marginTop: 4 }}>あと{entitlement.trialDaysLeft}日</Text>
          </View>
        ) : (
          <View>
            <Text style={{ fontSize: 14, fontWeight: '800', color: C.orange }}>無料期間が終了しました</Text>
            <Text style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 16 }}>
              AI機能を引き続き使うには購読が必要です。基本機能はこのまま無料で使えます。
            </Text>
          </View>
        )}

        {!entitlement?.subscribed && (
          <>
            {isPurchasesConfigured() ? (
              offering && offering.availablePackages[0] ? (
                <TouchableOpacity
                  onPress={handleSubscribe}
                  disabled={subscribing}
                  style={{ marginTop: 12, backgroundColor: subscribing ? C.muted : C.blue, borderRadius: 10, padding: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                    {subscribing ? '処理中...' : `購読する（${offering.availablePackages[0].product.priceString}）`}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>プランを読み込み中...</Text>
              )
            ) : (
              <Text style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>購読機能は準備中です</Text>
            )}
            <TouchableOpacity onPress={handleRestore} disabled={subscribing} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
              <Text style={{ fontSize: 12, color: C.blue, fontWeight: '700' }}>購入を復元</Text>
            </TouchableOpacity>
          </>
        )}

        {subMsg !== '' && <Text style={{ fontSize: 12, color: C.sub, marginTop: 10, lineHeight: 16 }}>{subMsg}</Text>}
      </View>

      <TouchableOpacity
        onPress={() => supabase.auth.signOut()}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          paddingVertical: 12, borderRadius: 10, borderWidth: 1,
          borderColor: C.red + '40', backgroundColor: C.red + '12',
        }}
      >
        <Text style={{ fontSize: 14 }}>🚪</Text>
        <Text style={{ fontSize: 13, color: C.red, fontWeight: '700' }}>ログアウト</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

