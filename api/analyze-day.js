import { checkAiEntitlement } from './_lib/entitlement.js'

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

  const entitlement = await checkAiEntitlement(req)
  if (!entitlement.ok) {
    return res.status(entitlement.status).json({ error: entitlement.error })
  }

  const {
    ftp,
    goalFtp,
    platform = 'Zwift',
    planned,
    actual,
    reviewStatus,
    recentHistory = [],
    tomorrowDayLabel,
    tomorrowIsRestDay,
  } = req.body || {}

  if (!ftp || !planned || !reviewStatus) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const plannedText =
    planned.type === 'rest'
      ? '休養日'
      : `${planned.name || ''} ${planned.duration || '?'}分 目標TSS${planned.tss || '?'} ${planned.zone || ''}${
          planned.description ? `（${planned.description}）` : ''
        }`

  const actualText = actual
    ? [
        actual.duration != null ? `時間${actual.duration}分` : null,
        actual.tss != null ? `TSS${actual.tss}` : null,
        actual.avgWatts != null ? `平均パワー${actual.avgWatts}W` : null,
        actual.weightedAvgWatts != null ? `NP${actual.weightedAvgWatts}W` : null,
        actual.avgHeartrate != null ? `平均心拍${actual.avgHeartrate}bpm` : null,
        actual.maxHeartrate != null ? `最大心拍${actual.maxHeartrate}bpm` : null,
        actual.avgCadence != null ? `平均ケイデンス${actual.avgCadence}rpm` : null,
      ]
        .filter(Boolean)
        .join(' / ')
    : null

  const historyText = recentHistory.length > 0 ? recentHistory.join(' / ') : 'データなし'

  const prompt = `You are an experienced cycling coach analyzing one athlete's training day in depth. Respond entirely in Japanese.

Athlete: current FTP ${ftp}W, goal FTP ${goalFtp || ftp}W.
Today's plan: ${plannedText}
Today's actual (from Strava, averages only — no second-by-second data): ${actualText || '活動記録なし'}
Rule-based verdict: ${reviewStatus}
Past 7 days trend: ${historyText}
Tomorrow (${tomorrowDayLabel || '?'}) is currently scheduled as: ${tomorrowIsRestDay ? '休養日' : '未定/上書き可能'}

Analyze power, heart rate and cadence together where data exists (e.g. power-to-heart-rate relationship as a fatigue/fitness signal, cadence habits, whether output matched the planned zone) — but only claim what average-level data actually supports, don't invent second-by-second trends you don't have. If heart rate or cadence data is missing, just skip that part instead of guessing.

Return ONLY this JSON, no markdown:
{
  "status": "今の状態を1〜2文で（体調・調子の傾向）",
  "analysis": "パワー・心拍・ケイデンスを踏まえた詳しい分析を2〜4文で",
  "recommendation": "次にすべきことを1〜2文で、具体的に",
  "tomorrow": {
    "type": "workout" or "rest" or "ftp_test",
    "name": "ワークアウト名（restの場合は省略可）",
    "duration": minutes as number or null,
    "tss": target TSS as number or null,
    "zone": "zone name or null",
    "description": "日本語の短い説明、なぜこの内容を提案するか含める"
  }
}

If tomorrow should stay a rest day, set "type":"rest" and other tomorrow fields to null.
When suggesting a workout for tomorrow, prefer using one of these exact names when the zone fits:
${workoutMenuFor(platform)}`

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
        max_tokens: 900,
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
