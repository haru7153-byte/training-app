import * as SecureStore from 'expo-secure-store'
import { supabase } from './supabase'

export const VERCEL_BASE = 'https://training-app-git-main-haru10.vercel.app'

async function currentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user.id ?? null
}

function scopedKey(base: string, userId: string) {
  return `${base}_${userId}`
}

/** Strava tokens are per Supabase user — this app has multiple accounts, so keys must be namespaced by user id. */
export async function loadStravaAuth(): Promise<{ token: string | null; athlete: any | null }> {
  const userId = await currentUserId()
  if (!userId) return { token: null, athlete: null }
  const token = await SecureStore.getItemAsync(scopedKey('strava_token', userId))
  const athleteJson = await SecureStore.getItemAsync(scopedKey('strava_athlete', userId))
  return { token, athlete: athleteJson ? JSON.parse(athleteJson) : null }
}

export async function saveStravaAuth(fields: { token?: string; refreshToken?: string; expiresAt?: string; athlete?: any }): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return
  if (fields.token) await SecureStore.setItemAsync(scopedKey('strava_token', userId), fields.token)
  if (fields.refreshToken) await SecureStore.setItemAsync(scopedKey('strava_refresh_token', userId), fields.refreshToken)
  if (fields.expiresAt) await SecureStore.setItemAsync(scopedKey('strava_expires_at', userId), fields.expiresAt)
  if (fields.athlete) await SecureStore.setItemAsync(scopedKey('strava_athlete', userId), JSON.stringify(fields.athlete))
}

export async function clearStravaAuth(): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return
  await SecureStore.deleteItemAsync(scopedKey('strava_token', userId))
  await SecureStore.deleteItemAsync(scopedKey('strava_athlete', userId))
  await SecureStore.deleteItemAsync(scopedKey('strava_refresh_token', userId))
  await SecureStore.deleteItemAsync(scopedKey('strava_expires_at', userId))
}

export async function getValidToken(): Promise<string | null> {
  const userId = await currentUserId()
  if (!userId) return null
  const t = await SecureStore.getItemAsync(scopedKey('strava_token', userId))
  if (!t) return null
  const expiresAt = await SecureStore.getItemAsync(scopedKey('strava_expires_at', userId))
  const refreshToken = await SecureStore.getItemAsync(scopedKey('strava_refresh_token', userId))
  const now = Math.floor(Date.now() / 1000)
  if (expiresAt && refreshToken && now > parseInt(expiresAt) - 300) {
    try {
      const res = await fetch(`${VERCEL_BASE}/api/strava-refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      const data = await res.json()
      if (data.access_token) {
        await SecureStore.setItemAsync(scopedKey('strava_token', userId), data.access_token)
        await SecureStore.setItemAsync(scopedKey('strava_refresh_token', userId), data.refresh_token)
        await SecureStore.setItemAsync(scopedKey('strava_expires_at', userId), String(data.expires_at))
        return data.access_token
      }
    } catch {}
  }
  return t
}

export interface StravaActivity {
  id: number
  type: string
  name: string
  distance: number
  moving_time: number
  total_elevation_gain: number
  average_speed?: number
  average_watts?: number
  weighted_average_watts?: number
  average_heartrate?: number
  max_heartrate?: number
  average_cadence?: number
  suffer_score?: number
  start_date_local: string
}

/** start_date_local looks like "2025-07-01T10:30:00Z" but the "Z" is misleading — it's already local time. */
export function activityLocalDateStr(act: StravaActivity): string {
  return act.start_date_local.substring(0, 10)
}

export function activityWeekdayIndex(act: StravaActivity): number {
  const [y, m, d] = activityLocalDateStr(act).split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay()
  return day === 0 ? 6 : day - 1
}

export function computeActivityTss(act: StravaActivity, ftp: number): number {
  const watts = act.weighted_average_watts || act.average_watts
  if (watts && ftp > 0) {
    const IF = watts / ftp
    return Math.round(((act.moving_time * watts * IF) / (ftp * 3600)) * 100)
  }
  if (act.suffer_score) return act.suffer_score
  return 0
}

export async function fetchActivitiesSince(afterUnix: number, token: string): Promise<StravaActivity[]> {
  const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${afterUnix}&per_page=50`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export function activitiesByLocalDate(activities: StravaActivity[]): Map<string, StravaActivity[]> {
  const map = new Map<string, StravaActivity[]>()
  for (const act of activities) {
    const key = activityLocalDateStr(act)
    const arr = map.get(key) || []
    arr.push(act)
    map.set(key, arr)
  }
  return map
}
