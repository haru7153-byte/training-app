const DAYS_JP = ['月', '火', '水', '木', '金', '土', '日']

const ZWIFT_WORKOUTS = `Zwift workouts (use ONLY these exact names):
- Recovery: Recovery Ride(30min,TSS20,zone:Recovery), Active Recovery(30min,TSS18,zone:Recovery)
- Endurance: Foundation(60min,TSS45,zone:Endurance), Endurance Ride(75min,TSS55,zone:Endurance)
- Tempo: Tempo(60min,TSS70,zone:Tempo)
- Sweet Spot: SST (Long)(75min,TSS90,zone:Sweet Spot)
- Threshold/FTP: The Gorby(50min,TSS85,zone:Threshold), Over Unders(60min,TSS92,zone:Threshold)
- VO2max: Spencer(55min,TSS95,zone:VO2max), Bluebell(50min,TSS90,zone:VO2max)
- Anaerobic: Microbursts(45min,TSS85,zone:Anaerobic)
- Race Prep: Openers(45min,TSS50,zone:Mixed)`

const MYWHOOSH_WORKOUTS = `MyWhoosh workouts (use ONLY these exact names):
- Recovery: Recovery Ride(30min,TSS18,zone:Recovery)
- Endurance: Endurance Base(60min,TSS48,zone:Endurance)
- Tempo: Tempo Builder(60min,TSS68,zone:Tempo)
- Sweet Spot: Sweet Spot Intervals(65min,TSS85,zone:Sweet Spot)
- Threshold/FTP: FTP Builder(60min,TSS88,zone:Threshold), Over Under Intervals(60min,TSS92,zone:Threshold)
- VO2max: VO2 Max Intervals(50min,TSS90,zone:VO2max)
- Anaerobic: Anaerobic Capacity(45min,TSS85,zone:Anaerobic)
- Sprint: Sprint Intervals(40min,TSS75,zone:Anaerobic)
- Race Prep: Race Openers(45min,TSS48,zone:Mixed)`

function workoutMenuFor(platform) {
  if (platform === 'MyWhoosh') return MYWHOOSH_WORKOUTS
  if (platform === '両方') return ZWIFT_WORKOUTS + '\n' + MYWHOOSH_WORKOUTS
  return ZWIFT_WORKOUTS
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    ftp,
    targetFtp,
    eventName,
    platform = 'Zwift',
    phase,
    weekTargetTss,
    isRecoveryWeek = false,
    restDayIndices = [],
    ftpTestDay = null,
  } = req.body || {}

  if (!ftp || !targetFtp || !phase || !weekTargetTss) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const trainingDays = DAYS_JP.filter((_, i) => !restDayIndices.includes(i)).join('・')
  const restDaysList = DAYS_JP.filter((_, i) => restDayIndices.includes(i)).join('・')
  const ftpTestDayLabel = ftpTestDay !== null && ftpTestDay !== undefined ? DAYS_JP[ftpTestDay] : null

  const prompt = `You are a cycling coach. Return ONLY valid JSON, no explanation.
FTP:${ftp}W Target:${targetFtp}W Race:"${eventName || ''}" Platform:${platform}
Phase:${phase}${isRecoveryWeek ? ' (recovery week — keep intensity low)' : ''} Weekly target TSS:${weekTargetTss}
Training days:${trainingDays || 'none'} Rest days:${restDaysList || 'none'}
${ftpTestDayLabel ? `FTP test day:${ftpTestDayLabel} — this day MUST be type "ftp_test" with a short standard FTP test protocol (e.g. 20min all-out test with warmup) as the description, not a menu workout.` : ''}

Available workouts:
${workoutMenuFor(platform)}

Rules:
- Use workout names EXACTLY as listed above when the zone matches
- If no listed workout fits the needed zone, use a descriptive name like "60min Endurance Ride" or "3x10min Threshold" (never invent platform-specific names)
- Use duration and TSS from the list above when using a listed workout
- The sum of all workout TSS across the 7 days should be close to the weekly target TSS
- Rest days and the FTP test day must match what was specified above exactly

JSON (all 7 days 月火水木金土日, advice/description in Japanese):
{"days":[{"day":"月","type":"workout","platform":"${platform}","name":"SST Short","duration":45,"tss":65,"zone":"Sweet Spot","description":"日本語の詳細説明"},{"day":"火","type":"rest"},{"day":"水","type":"ftp_test","duration":30,"tss":70,"description":"日本語の詳細説明"},...]}`

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const d = await r.json()
    if (!d.content?.[0]?.text) throw new Error(JSON.stringify(d))
    const text = d.content[0].text
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('no json')
    res.status(200).json(JSON.parse(match[0]))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
