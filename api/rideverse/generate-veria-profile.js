import { AI_CONFIG } from './_lib/config.js'
import { chatJSON } from './_lib/openaiClient.js'
import { pickRandomFlavorHint } from './_lib/randomFlavor.js'
import {
  bikeTypeDirectionText,
  CHARACTER_DESIGN_RULES,
  GENERATION_ORDER_NOTE,
  GENERATION_WEIGHTS_NOTE,
  PERSONALITY_EXAMPLES,
  WORLD_VIEW,
} from './_lib/veriaDesignReference.js'

// STEP2 Personality — text/profile generation only, completely independent of
// image generation (see generate-veria-image.js). Either side can change
// model or prompt without touching the other.
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

${bikeTypeDirectionText(bikeInfo.bikeType)}

${GENERATION_WEIGHTS_NOTE}

${GENERATION_ORDER_NOTE}

${PERSONALITY_EXAMPLES}

このライダーの自転車情報:
- Bike Type: ${bikeInfo.bikeType}
- メーカー: ${bikeInfo.manufacturer}
- モデル: ${bikeInfo.model}
- メインカラー: ${bikeInfo.mainColor}
- 差し色: ${bikeInfo.accentColor}
- ホイール: ${bikeInfo.wheelDepth}
- フレーム: ${bikeInfo.frameStyle}

ライダーの回答: ${JSON.stringify(answers)}

個性のゆらぎ（完全一致を防ぐための小さなヒント、性格の大枠は変えないこと）: ${pickRandomFlavorHint()}

この情報から、このライダーだけの世界に一人だけのヴェリアのプロフィールを日本語で生成して。
以下のJSON形式のみで出力すること:
{
  "species": "種族（例: Wolf, Fox, Bear, Rabbit など。方向性の候補群を優先しつつ日本語表記も可）",
  "appearance": "見た目の特徴を2〜3文で（毛色・瞳の色・装備など、カラー情報を反映すること）",
  "personality": "性格を1〜2文で",
  "keywords": ["性格や雰囲気を表すキーワードを3〜5個"],
  "voiceTone": "話し方・声の調子を一言で（例: 元気で明るい）",
  "greeting": "初対面の挨拶を1文で",
  "favoriteRide": "好きなライドシーンを1文で",
  "favoriteSeason": "好きな季節とその理由を1文で",
  "nameCandidates": ["名前候補1", "名前候補2", "名前候補3"]
}`

  try {
    const result = await chatJSON({
      model: AI_CONFIG.textModel,
      messages: [
        { role: 'system', content: 'あなたはRIDEVERSE公式キャラクターデザイナーです。設定に忠実に、一貫性のあるヴェリアのプロフィールを作成します。' },
        { role: 'user', content: prompt },
      ],
    })

    res.status(200).json({
      species: result.species,
      appearance: result.appearance,
      personality: result.personality,
      keywords: result.keywords || [],
      voiceTone: result.voiceTone,
      greeting: result.greeting,
      favoriteRide: result.favoriteRide,
      favoriteSeason: result.favoriteSeason,
      nameCandidates: result.nameCandidates || [],
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
