export default async function handler(req, res) {
  const { code } = req.query

  if (!code) {
    return res.status(400).json({ error: 'No code provided' })
  }

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })

  const data = await response.json()

  if (data.errors || !data.access_token) {
    console.log('[strava-callback] token exchange failed', JSON.stringify(data))
    return res.status(400).json({ error: 'Token exchange failed' })
  }

  const params = new URLSearchParams({
    strava_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: String(data.expires_at),
    athlete: encodeURIComponent(JSON.stringify(data.athlete)),
  })

  const redirectUrl = `trainingapp://strava-callback?${params.toString()}`
  console.log('[strava-callback] redirecting to', redirectUrl)

  // ASWebAuthenticationSession(expo-web-browser の openAuthSessionAsync)は
  // trainingapp:// へのナビゲーションを検知して自動的にアプリへ結果を返す。
  // サーバー側の302リダイレクトが最も確実に検知される。
  res.redirect(redirectUrl)
}
