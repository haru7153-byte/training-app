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

  // ポップアップとして開かれた場合はwindow.openerへpostMessageして即クローズ。
  // 通常のページ遷移として開かれた場合(ポップアップがブロックされた等)は/にリダイレクト。
  const payload = JSON.stringify({
    type: 'strava-auth',
    strava_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete: data.athlete,
  }).replace(/</g, '\\u003c')

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(200).send(`<!DOCTYPE html>
<html><body>
<script>
  var payload = ${payload};
  if (window.opener) {
    window.opener.postMessage(payload, window.location.origin);
    window.close();
  } else {
    var params = new URLSearchParams({
      strava_token: payload.strava_token,
      refresh_token: payload.refresh_token,
      expires_at: String(payload.expires_at),
      athlete: encodeURIComponent(JSON.stringify(payload.athlete)),
    });
    window.location.href = '/?' + params.toString();
  }
</script>
Strava連携が完了しました。このウィンドウは閉じてください。
</body></html>`)
}
