// Shared character-design contract. Both the image prompt and the text/profile
// prompt import this so the visual style and the written personality never drift
// apart, even though the two AI calls are otherwise fully independent.
import { AI_CONFIG } from './config.js'

export const WORLD_VIEW = `RIDEVERSEには「ヴェリア」という小さな精霊が存在する。
ヴェリアはライダー・自転車・景色・風・思い出から生まれる存在で、ライダーとは対等なパートナーであり、ペットではない。`

export const CHARACTER_DESIGN_RULES = `キャラクターデザインの必須条件:
- 2.5頭身のSDキャラクター
- ケモノ精霊、アニメ調
- 柔らかい塗り、丸く親しみやすいシルエット
- 少しだけファンタジーな要素

禁止事項（絶対に含めない）:
- リアル調の質感
- 筋肉質な体型
- ホラー・怖い表情
- 厚塗りのタッチ
- 人間そのものの姿`

export function styleReferenceNote() {
  if (!AI_CONFIG.styleReferenceImageUrl) return ''
  return `\n公式ヴェリア（1号機）を画風のリファレンスとする: ${AI_CONFIG.styleReferenceImageUrl}`
}
