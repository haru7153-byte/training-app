import { AI_CONFIG } from './_lib/config.js'
import { chatJSON } from './_lib/openaiClient.js'
import { answersToThemeKeywords } from './_lib/answerThemeMap.js'
import { bikeDesignThemeKeywords } from './_lib/colorMoodMap.js'
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
//
// Generation order enforced by the prompt: BikeType -> Theme -> Species ->
// Emotion Keywords -> Personality -> Appearance (last) -> Voice.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { bikeInfo, answers } = req.body || {}
  if (!bikeInfo || !answers) {
    return res.status(400).json({ error: 'Missing bikeInfo or answers' })
  }

  // Raw answers never reach the model — they're converted to Theme Keywords first.
  const questionThemeKeywords = answersToThemeKeywords(answers)
  const designThemeKeywords = bikeDesignThemeKeywords(bikeInfo)
  const randomFlavorHint = pickRandomFlavorHint()

  const prompt = `${WORLD_VIEW}

${CHARACTER_DESIGN_RULES}

${bikeTypeDirectionText(bikeInfo.bikeType)}

${GENERATION_WEIGHTS_NOTE}

${GENERATION_ORDER_NOTE}

${PERSONALITY_EXAMPLES}

質問回答から変換したThemeキーワード（生の回答はAIに渡していません）: ${questionThemeKeywords.join(', ') || 'なし'}
自転車デザインから変換したThemeキーワード: ${designThemeKeywords.join(', ') || 'なし'}
個性のゆらぎ（10%以内の小さなヒント。Theme/Species/性格の大枠は変えないこと）: ${randomFlavorHint}

自転車情報（Appearance生成時にのみ使う色情報）:
- Bike Type: ${bikeInfo.bikeType}
- メインカラー: ${bikeInfo.mainColor}
- 差し色: ${bikeInfo.accentColor}

このライダーだけの世界に一人だけのヴェリアを日本語で生成して。以下のJSON形式のみで出力すること:
{
  "theme": { "keywords": ["Themeキーワードを3〜5個"], "summary": "Themeを一言で（例: 風と自由をまとうテーマ）" },
  "species": { "name": "Species候補群から選ぶか、Themeに近い種族(例: Wolf)" },
  "personality": {
    "emotionKeywords": ["性格を表す短い単語を3〜5個(例: Brave, Cheerful, Calm)"],
    "description": "emotionKeywordsを組み合わせた性格の説明文を1〜2文で",
    "favoriteRide": "好きなライドシーンを1文で",
    "favoriteSeason": "好きな季節とその理由を1文で"
  },
  "appearance": { "description": "Species・Personality・Theme・メインカラー・差し色を反映した見た目の説明を2〜3文で（必ず最後に決定すること）" },
  "voice": { "tone": "話し方・声の調子を一言で", "greeting": "初対面の挨拶を1文で" },
  "metadata": {
    "nameCandidates": ["名前候補1", "名前候補2", "名前候補3"],
    "generationReason": "このヴェリアがこのTheme・Speciesになった理由を、ライダーが好むもの（景色・季節・ライドスタイルなど）に触れながら1〜2文で説明。例: 'あなたは朝のライドと海辺の景色が好きなので、風をテーマにしたウルフのヴェリアが誕生しました。'"
  }
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
      theme: result.theme,
      species: result.species,
      personality: result.personality,
      appearance: result.appearance,
      voice: result.voice,
      metadata: result.metadata,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
