import { LogBox } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'notification_settings'

export interface NotificationSettings {
  enabled: boolean
  hour: number
  minute: number
}

const DEFAULT_SETTINGS: NotificationSettings = { enabled: false, hour: 20, minute: 0 }

// expo-notificationsは、importされた時点でネイティブモジュール（ExpoPushTokenManager等）を
// 読み込もうとする。まだそれが組み込まれていないビルド（次のEASビルド待ち）でアプリ全体が
// 起動時にクラッシュしないよう、静的importではなく遅延requireにしてtry/catchで囲む。
let cachedModule: any = undefined

function getNotifications(): any {
  if (cachedModule !== undefined) return cachedModule
  try {
    const mod = require('expo-notifications')
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    })
    cachedModule = mod
  } catch {
    // 次のビルドでネイティブモジュールが入るまでの間だけ出る、実害のない赤画面を抑制する。
    LogBox.ignoreLogs(["Cannot find native module 'ExpoPushTokenManager'"])
    cachedModule = null
  }
  return cachedModule
}

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  const json = await AsyncStorage.getItem(STORAGE_KEY)
  if (!json) return DEFAULT_SETTINGS
  try {
    const parsed = JSON.parse(json)
    return {
      enabled: !!parsed.enabled,
      hour: Number.isInteger(parsed.hour) ? parsed.hour : DEFAULT_SETTINGS.hour,
      minute: Number.isInteger(parsed.minute) ? parsed.minute : DEFAULT_SETTINGS.minute,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** 通知設定を反映する：オンなら（必要に応じて許可をリクエストして）毎日の通知を予約、オフなら全て取り消す。設定はAsyncStorageに保存される。 */
export async function applyNotificationSettings(
  settings: NotificationSettings
): Promise<{ ok: boolean; reason?: 'permission_denied' | 'unavailable' }> {
  const Notifications = getNotifications()
  if (!Notifications) {
    return { ok: false, reason: 'unavailable' }
  }

  await Notifications.cancelAllScheduledNotificationsAsync()

  if (!settings.enabled) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    return { ok: true }
  }

  const current = await Notifications.getPermissionsAsync()
  let status = current.status
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync()
    status = requested.status
  }
  if (status !== 'granted') {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, enabled: false }))
    return { ok: false, reason: 'permission_denied' }
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'AI CycleNote',
      body: '今日の記録をチェックしてみましょう。無理せず、できる範囲で大丈夫です。',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: settings.hour,
      minute: settings.minute,
    },
  })
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  return { ok: true }
}
