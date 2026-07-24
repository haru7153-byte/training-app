import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

const supabaseUrl = 'https://ohmlqpmxgsqyrwepvleo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obWxxcG14Z3NxeXJ3ZXB2bGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzMzMTQsImV4cCI6MjA5NzcwOTMxNH0.SuYdVdaGmfppFYvQAIRdIShVXf4L4LTFsk2ocQVp90A'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})