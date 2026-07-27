import { AI_CONFIG } from './_lib/config.js'
import { generateImage } from './_lib/openaiClient.js'
import {
  bikeTypeDirectionText,
  CHARACTER_DESIGN_RULES,
  IMAGE_NEGATIVE_PROMPT,
  OFFICIAL_REFERENCE_STYLE_NOTE,
  SD_PROPORTION_MANDATE,
  STYLE_DNA,
  WORLD_VIEW,
} from './_lib/veriaDesignReference.js'

// STEP3 Image Generation — a separate model/prompt/endpoint from
// generate-veria-profile.js (STEP2), so either can be swapped independently.
// It does take theme/species/personality produced by STEP2 as input (per the
// spec), so the client calls STEP2 first and passes its result here — that's
// a data hand-off, not a code dependency between the two services.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { bikeInfo, theme, species, personality } = req.body || {}
  if (!bikeInfo || !species?.name) {
    return res.status(400).json({ error: 'Missing bikeInfo or species' })
  }

  const colorGuidance = `カラー反映ルール: メインカラー「${bikeInfo.mainColor}」を毛色・瞳・ジャージ・自転車のフレームに、差し色「${bikeInfo.accentColor}」を小物・アクセサリー・自転車の差し色部分に使うこと。`
  const bikeGuidance = `Bike: this rider's own ${bikeInfo.bikeType} bicycle, held upright by its handlebar with one hand while the character stands beside it.`

  const prompt = `${WORLD_VIEW}

${CHARACTER_DESIGN_RULES}

${OFFICIAL_REFERENCE_STYLE_NOTE}

${SD_PROPORTION_MANDATE}

${bikeTypeDirectionText(bikeInfo.bikeType)}

Create one original Velia.

Theme: ${theme?.summary || ''} (${(theme?.keywords || []).join(', ')})
Species: ${species.name}
Personality: ${personality?.description || ''} (${(personality?.emotionKeywords || []).join(', ')})
${bikeGuidance}
${colorGuidance}

Style DNA (must include every one of these in the rendered character):
${STYLE_DNA.map((line) => `- ${line}`).join('\n')}

Negative prompt (must NOT include any of these):
${IMAGE_NEGATIVE_PROMPT.map((line) => `- ${line}`).join('\n')}`

  try {
    const imageUrl = await generateImage({ model: AI_CONFIG.imageModel, prompt })
    res.status(200).json({ imageUrl, imagePrompt: prompt })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
