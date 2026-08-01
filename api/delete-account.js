// アカウント削除（Apple審査ガイドライン5.1.1(v): アプリ内アカウント登録には
// アプリ内からの削除手段が必須）。呼び出し元の本人性をアクセストークンで
// 検証した上で、そのユーザーの全データを削除し、最後にauthアカウント自体も削除する。

const SUPABASE_URL = 'https://ohmlqpmxgsqyrwepvleo.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obWxxcG14Z3NxeXJ3ZXB2bGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzMzMTQsImV4cCI6MjA5NzcwOTMxNH0.SuYdVdaGmfppFYvQAIRdIShVXf4L4LTFsk2ocQVp90A'

// user_scoping_migration.sql / monetization_migration.sqlで user_id 列を持つテーブル。
// FK制約はcascadeだが、念のため子テーブルから順に明示的に消す。
const TABLES_IN_DELETE_ORDER = ['plan_day', 'plan_week', 'training_plan', 'ftp_log', 'weight_log', 'app_user', 'subscription']

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'missing_token' })

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  })
  if (!userRes.ok) return res.status(401).json({ error: 'invalid_token' })
  const user = await userRes.json()
  const userId = user?.id
  if (!userId) return res.status(401).json({ error: 'invalid_token' })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'server misconfigured' })

  const adminHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  try {
    for (const table of TABLES_IN_DELETE_ORDER) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${userId}`, {
        method: 'DELETE',
        headers: adminHeaders,
      })
      if (!r.ok && r.status !== 404) {
        throw new Error(`Failed to delete from ${table}: ${await r.text()}`)
      }
    }

    const delUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    })
    if (!delUserRes.ok) {
      throw new Error(`Failed to delete auth user: ${await delUserRes.text()}`)
    }

    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
