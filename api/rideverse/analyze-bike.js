import { AI_CONFIG } from './_lib/config.js'
import { chatJSON } from './_lib/openaiClient.js'

// OpenAI Vision analysis of a bike photo. Purely an assist — the UI always lets
// the rider correct the manufacturer/color candidates by hand.
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
            '自転車の写真からメーカー候補とカラー候補を推測するアシスタント。断定できない場合も推測でよい。',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '写真の自転車について、メーカー候補を最大3件、カラー候補を最大3件、日本語でJSON出力して。フォーマット: {"manufacturerCandidates":["..."],"colorCandidates":["..."]}',
            },
            { type: 'image_url', image_url: { url: imageBase64 } },
          ],
        },
      ],
    })

    res.status(200).json({
      manufacturerCandidates: result.manufacturerCandidates || [],
      colorCandidates: result.colorCandidates || [],
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
