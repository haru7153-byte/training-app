export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    date,
    dayType,
    plannedName,
    plannedDuration,
    plannedTss,
    plannedZone,
    plannedDescription,
    reviewStatus,
    actualSummary,
  } = req.body || {}

  if (!date || !dayType || !reviewStatus) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const planned =
    dayType === 'rest'
      ? '休養日'
      : `${plannedName || ''} ${plannedDuration || '?'}分 TSS${plannedTss || '?'} ${plannedZone || ''}${
          plannedDescription ? ` (${plannedDescription})` : ''
        }`

  const prompt = `You are a cycling coach reviewing one day of training. Respond in Japanese, max 120 characters, one short paragraph, practical and encouraging but honest.
Date:${date} Day type:${dayType}
Planned:${planned}
Actual:${actualSummary || '活動記録なし'}
Rule-based verdict:${reviewStatus}

Return ONLY this JSON: {"comment":"レビューコメント"}`

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
        max_tokens: 300,
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
