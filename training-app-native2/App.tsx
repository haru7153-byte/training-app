import { useState, useEffect, ReactElement } from 'react'
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { GoalType, TrainingFocus } from './lib/plan'
import { ensureAppUserRow } from './lib/entitlements'
import { initPurchases } from './lib/purchases'
import { initCrashReporting, wrapWithCrashReporting } from './lib/crashReporting'
import { C, TABS, styles } from './lib/theme'
import HomeScreen from './screens/HomeScreen'
import PlanScreen from './screens/PlanScreen'
import StravaScreen from './screens/StravaScreen'
import WeightScreen from './screens/WeightScreen'
import GoalsScreen from './screens/GoalsScreen'
import AuthScreen from './screens/AuthScreen'

initCrashReporting()

function App() {
  const [tab, setTab] = useState('home')
  const [ftp, setFtp] = useState(300)
  const [goals, setGoals] = useState({
    targetFtp: 320, targetTSS: 420, eventName: 'グランフォンドKyoto', targetWeight: 70,
    goalType: 'race' as GoalType, ftpTestEnabled: true, trainingFocus: 'balanced' as TrainingFocus,
  })
  const [eventDate, setEventDate] = useState<Date | null>(new Date('2025-10-15'))
  const [planUpdatePending, setPlanUpdatePending] = useState(false)

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
    ensureAppUserRow(session.user.id)
    initPurchases(session.user.id)
    supabase.from('ftp_log').select('ftp').order('recorded_at', { ascending: false }).limit(1)
      .then(({ data }: { data: any }) => { setFtp(data && data.length > 0 ? data[0].ftp : 300) })
    AsyncStorage.getItem('user_goals').then(json => {
      if (!json) return
      const g = JSON.parse(json)
      setGoals({
        targetFtp:    parseInt(g.targetFtp)    || 320,
        targetTSS:    parseInt(g.targetTSS)    || 420,
        eventName:    g.eventName              || 'グランフォンドKyoto',
        targetWeight: parseFloat(g.targetWeight) || 70,
        goalType:     g.goalType === 'ongoing' ? 'ongoing' : 'race',
        ftpTestEnabled: g.ftpTestEnabled !== undefined ? !!g.ftpTestEnabled : true,
        trainingFocus: g.trainingFocus === 'climbing' || g.trainingFocus === 'criterium' ? g.trainingFocus : 'balanced',
      })
      setEventDate(g.goalType === 'ongoing' ? null : g.eventDate ? new Date(g.eventDate) : new Date('2025-10-15'))
    })
  }, [session])

  const screens: Record<string, ReactElement> = {
    home:   <HomeScreen ftp={ftp} goalFtp={goals.targetFtp} goalTSS={goals.targetTSS} />,
    plan:   <PlanScreen
              ftp={ftp} goalFtp={goals.targetFtp} goalTSS={goals.targetTSS}
              goal={{ type: goals.goalType, label: goals.eventName, eventDate, ftpTestEnabled: goals.ftpTestEnabled, trainingFocus: goals.trainingFocus }}
              autoOpenRecreate={planUpdatePending}
              onAutoOpenRecreateHandled={() => setPlanUpdatePending(false)}
            />,
    strava: <StravaScreen onFtpUpdate={setFtp} />,
    weight: <WeightScreen goalWeight={goals.targetWeight} />,
    goals:  <GoalsScreen ftp={ftp} onGoalsChange={g => { setGoals(g); setEventDate(g.eventDate); setPlanUpdatePending(true) }} onFtpUpdate={setFtp} />,
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

export default wrapWithCrashReporting(App)
