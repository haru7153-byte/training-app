import { AI_CONFIG } from './_lib/config.js'
import { generateImage } from './_lib/openaiClient.js'
import { CHARACTER_DESIGN_RULES, styleReferenceNote, WORLD_VIEW } from './_lib/veriaDesignReference.js'

// Image generation only — completely independent of generate-veria-profile.js.
// Takes the same raw inputs (bike + answers) rather than depending on the text
// output, so either call can fail, retry, or swap providers on its own.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { bikeInfo, answers } = req.body || {}
  if (!bikeInfo || !answers) {
    return res.status(400).json({ error: 'Missing bikeInfo or answers' })
  }

  const prompt = `${WORLD_VIEW}

${CHARACTER_DESIGN_RULES}${styleReferenceNote()}

このライダーの自転車: メーカー「${bikeInfo.manufacturer}」、カラー「${bikeInfo.color}」
ライダーの好み: ${JSON.stringify(answers)}

上記の設定に基づき、このライダーだけの世界に一人だけのヴェリアを1体、正面向き全身で描いてください。
背景はシンプルに、キャラクター単体が主役になるように。`

  try {
    const imageUrl = await generateImage({ model: AI_CONFIG.imageModel, prompt })
    res.status(200).json({ imageUrl })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
