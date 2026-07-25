export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { days, activities } = req.body || {}

  function summarizeActivities(acts) {
    return acts
      .map(a => {
        const km = (a.distance / 1000).toFixed(1)
        const mins = Math.floor(a.moving_time / 60)
        const watts = a.weighted_average_watts || a.average_watts
        return `${a.type} ${km}km ${mins}min${watts ? ` ${Math.round(watts)}W` : ''}${
          a.suffer_score ? ` suffer:${a.suffer_score}` : ''
        }`
      })
      .join(', ')
  }

  let summary
  if (Array.isArray(days) && days.length > 0) {
    // 過去7日分を、活動が無い日＝休息日も含めて並べる
    summary = days
      .map(d => `${d.date}: ${Array.isArray(d.activities) && d.activities.length > 0 ? summarizeActivities(d.activities) : '休息日（活動記録なし）'}`)
      .join('\n')
  } else if (Array.isArray(activities) && activities.length > 0) {
    // 後方互換: 旧形式（活動一覧のみ）
    summary = activities
      .slice(0, 10)
      .map(a => `${a.start_date_local.substring(0, 10)} ${summarizeActivities([a])}`)
      .join('\n')
  } else {
    return res.status(400).json({ error: 'No activities provided' })
  }

  const prompt = `You are a cycling coach. Analyze this athlete's past 7 days, which includes rest days with no recorded activity — treat rest days as a normal, necessary part of the week, not as a gap to criticize. Respond in Japanese with practical advice (max 150 chars per section):
Past 7 days (oldest to newest):
${summary}

Return ONLY this JSON: {"fatigue":"疲労度評価（低/中/高）と理由","balance":"強度バランス評価（運動日と休息日のバランスも含む）","recommendation":"今週のアドバイス","todayAdvice":"今日すべきこと"}`

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
