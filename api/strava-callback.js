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

  // 3通りの環境に対応する:
  // 1. ポップアップ(window.opener あり) → postMessageで即座に渡してクローズ
  // 2. ネイティブアプリ(dev-client/TestFlightビルド) → trainingapp://スキームを試す
  // 3. 通常のWeb/PWA → 上記が反応しなければ/にフォールバック
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
  var params = new URLSearchParams({
    strava_token: payload.strava_token,
    refresh_token: payload.refresh_token,
    expires_at: String(payload.expires_at),
    athlete: encodeURIComponent(JSON.stringify(payload.athlete)),
  });

  function fallbackToWeb() {
    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
    } else {
      window.location.href = '/?' + params.toString();
    }
  }

  if (window.opener) {
    fallbackToWeb();
  } else {
    // ネイティブアプリがカスタムスキームを拾えば、このページは離脱されるので
    // フォールバックのタイマーは発火しない
    var timer = setTimeout(fallbackToWeb, 1500);
    window.addEventListener('pagehide', function () { clearTimeout(timer); });
    window.location.href = 'trainingapp://strava-callback?' + params.toString();
  }
</script>
Strava連携が完了しました。このウィンドウは閉じてください。
</body></html>`)
}
