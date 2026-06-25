export default async function handler(req, res) {
    const { code } = req.query;
  
    if (!code) {
      return res.status(400).json({ error: "No code provided" });
    }
  
    // StravaのアクセストークンをClientIDとSecretで取得
    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });
  
    const data = await response.json();
  
    if (data.errors) {
      return res.status(400).json({ error: "Token exchange failed" });
    }
  
    // トークンをURLパラメータでフロントに渡す
    const redirectUrl = `/?strava_token=${data.access_token}&athlete=${encodeURIComponent(JSON.stringify(data.athlete))}`;
    res.redirect(redirectUrl);
  }