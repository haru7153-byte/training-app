import { AI_CONFIG } from './_lib/config.js'
import { chatJSON } from './_lib/openaiClient.js'
import { CHARACTER_DESIGN_RULES, WORLD_VIEW } from './_lib/veriaDesignReference.js'

// Text/profile generation only — completely independent of image generation
// (see generate-veria-image.js). Either side can change model or prompt without
// touching the other.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { bikeInfo, answers } = req.body || {}
  if (!bikeInfo || !answers) {
    return res.status(400).json({ error: 'Missing bikeInfo or answers' })
  }

  const prompt = `${WORLD_VIEW}

${CHARACTER_DESIGN_RULES}

このライダーの自転車情報: メーカー「${bikeInfo.manufacturer}」、カラー「${bikeInfo.color}」
ライダーの回答: ${JSON.stringify(answers)}

この情報から、このライダーだけの世界に一人だけのヴェリアのプロフィールを日本語で生成して。
以下のJSON形式のみで出力すること:
{
  "species": "種族（例: ケモノ精霊・うさぎ型）",
  "attributes": { "element": "ファンタジー属性（例: 風）", "colorTheme": "色テーマ" },
  "personality": "性格を1〜2文で",
  "introduction": "紹介文を2〜3文で、ライダーと一緒に走りたくなるような温かい文章",
  "nameCandidates": ["名前候補1", "名前候補2", "名前候補3"]
}`

  try {
    const result = await chatJSON({
      model: AI_CONFIG.textModel,
      messages: [
        { role: 'system', content: 'あなたはRIDEVERSEの世界観に基づきヴェリアのプロフィールを作る作家です。' },
        { role: 'user', content: prompt },
      ],
    })

    res.status(200).json({
      species: result.species,
      attributes: result.attributes,
      personality: result.personality,
      introduction: result.introduction,
      nameCandidates: result.nameCandidates || [],
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
