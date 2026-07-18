export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { activities } = req.body || {}
  if (!Array.isArray(activities) || activities.length === 0) {
    return res.status(400).json({ error: 'No activities provided' })
  }

  const summary = activities
    .slice(0, 10)
    .map(a => {
      const km = (a.distance / 1000).toFixed(1)
      const mins = Math.floor(a.moving_time / 60)
      const watts = a.weighted_average_watts || a.average_watts
      const date = a.start_date_local.substring(0, 10)
      return `${date} ${a.type} ${km}km ${mins}min${watts ? ` ${Math.round(watts)}W` : ''}${
        a.suffer_score ? ` suffer:${a.suffer_score}` : ''
      }`
    })
    .join('\n')

  const prompt = `You are a cycling coach. Analyze these recent activities and respond in Japanese with practical advice (max 150 chars per section):
Activities:
${summary}

Return ONLY this JSON: {"fatigue":"疲労度評価（低/中/高）と理由","balance":"強度バランス評価","recommendation":"今週のアドバイス","todayAdvice":"今日すべきこと"}`

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const d = await r.json()
    if (!d.content?.[0]?.text) throw new Error(JSON.stringify(d))
    const match = d.content[0].text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('no json')
    res.status(200).json(JSON.parse(match[0]))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
