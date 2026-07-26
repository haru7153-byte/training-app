import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { appConfig } from '@/config/appConfig'

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

/** MVP has no sign-up flow yet — an anonymous Supabase auth user is the owner of record. */
export async function ensureUser() {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user

  const { data: signInData, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return signInData.user
}
