import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { getValidToken, fetchActivitiesSince, activityWeekdayIndex, computeActivityTss } from '../lib/strava'
import { C, styles } from '../lib/theme'

export default function HomeScreen({ ftp, goalFtp, goalTSS }: { ftp: number; goalFtp: number; goalTSS: number }) {
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
