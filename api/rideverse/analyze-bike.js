import { AI_CONFIG } from './_lib/config.js'
import { chatJSON } from './_lib/openaiClient.js'

// STEP1 Vision — analyzes a bike photo only. No guessing: anything the model
// can't read from the photo must come back as "unknown", and the UI always
// lets the rider correct every field by hand regardless.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageBase64 } = req.body || {}
  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing imageBase64' })
  }

  try {
    const result = await chatJSON({
      model: AI_CONFIG.visionModel,
      messages: [
        {
          role: 'system',
          content:
            'あなたは自転車専門の画像解析AIです。以下をJSONのみで返してください。不明な項目は必ず"unknown"を返してください。推測は禁止です。',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `写真の自転車を解析して、次のJSON形式のみで出力して:
{
  "bikeType": "road" | "mtb" | "gravel" | "mini_velo" | "mamachari" | "unknown",
  "manufacturer": "メーカー名 or unknown",
  "model": "モデル名 or unknown",
  "mainColor": "メインカラー or unknown",
  "accentColor": "差し色 or unknown",
  "wheelDepth": "ホイールの見た目の深さ(例: shallow/deep) or unknown",
  "frameStyle": "フレーム形状の特徴(例: aero/endurance/mtb/city) or unknown"
}
bikeTypeは列挙値以外を使わないこと。判断できない場合は必ず"unknown"にすること。`,
            },
            { type: 'image_url', image_url: { url: imageBase64 } },
          ],
        },
      ],
    })

    res.status(200).json({
      bikeType: result.bikeType || 'unknown',
      manufacturer: result.manufacturer || 'unknown',
      model: result.model || 'unknown',
      mainColor: result.mainColor || 'unknown',
      accentColor: result.accentColor || 'unknown',
      wheelDepth: result.wheelDepth || 'unknown',
      frameStyle: result.frameStyle || 'unknown',
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
