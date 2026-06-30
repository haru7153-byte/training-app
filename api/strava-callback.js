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
    return res.status(400).json({ error: 'Token exchange failed' })
  }

  const params = new URLSearchParams({
    strava_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: String(data.expires_at),
    athlete: encodeURIComponent(JSON.stringify(data.athlete)),
  })

  // カスタムスキームでアプリに戻る（WebBrowser.openAuthSessionAsync が検知）
  res.redirect(`trainingapp://strava-callback?${params.toString()}`)
}
