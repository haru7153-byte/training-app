// RevenueCatダッシュボード（Project settings → Integrations → Webhooks）で、
// このエンドポイントのURLと、下記で照合する秘密の値（Authorizationヘッダー）を設定すること。
// Vercel側では環境変数 REVENUECAT_WEBHOOK_SECRET と SUPABASE_SERVICE_ROLE_KEY が必要。

const SUPABASE_URL = 'https://ohmlqpmxgsqyrwepvleo.supabase.co'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const expected = process.env.REVENUECAT_WEBHOOK_SECRET
  const authHeader = req.headers['authorization'] || ''
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return res.status(500).json({ error: 'server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' })
  }

  const event = req.body?.event
  const userId = event?.app_user_id
  if (!userId) {
    return res.status(400).json({ error: 'missing app_user_id' })
  }

  // CANCELLATIONは「自動更新をオフにした」だけで、期限まではまだ有効。
  // 実際に使えなくなるのはEXPIRATIONのタイミング。
  let status = 'active'
  if (event.type === 'EXPIRATION') status = 'expired'
  else if (event.period_type === 'TRIAL') status = 'trialing'

  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/subscription`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify([{ user_id: userId, status, expires_at: expiresAt, updated_at: new Date().toISOString() }]),
    })
    if (!r.ok) throw new Error(await r.text())
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
