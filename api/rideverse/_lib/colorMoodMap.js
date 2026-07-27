// Bike design (20% of Theme) also gets converted to keywords rather than
// handed to the model as a raw color string — same principle as answerThemeMap.js.
const COLOR_MOOD_MAP = [
  { pattern: /blue|ブルー|青|セレステ/i, keywords: ['Calm', 'Freedom', 'Cool'] },
  { pattern: /red|レッド|赤/i, keywords: ['Passion', 'Energetic', 'Bold'] },
  { pattern: /green|グリーン|緑/i, keywords: ['Nature', 'Calm', 'Fresh'] },
  { pattern: /yellow|イエロー|黄/i, keywords: ['Cheerful', 'Bright', 'Playful'] },
  { pattern: /orange|オレンジ|橙/i, keywords: ['Energetic', 'Warm', 'Friendly'] },
  { pattern: /pink|ピンク|桃/i, keywords: ['Kind', 'Cute', 'Gentle'] },
  { pattern: /purple|パープル|紫/i, keywords: ['Mystery', 'Elegant'] },
  { pattern: /black|ブラック|黒/i, keywords: ['Cool', 'Confident'] },
  { pattern: /white|ホワイト|白/i, keywords: ['Pure', 'Calm'] },
  { pattern: /silver|グレー|グレイ|銀|灰/i, keywords: ['Composed', 'Cool'] },
]

/** Best-effort mood keywords from a free-text color name. Returns [] for unknown/"unknown" colors. */
function colorToKeywords(colorText) {
  if (!colorText || colorText === 'unknown') return []
  const match = COLOR_MOOD_MAP.find(({ pattern }) => pattern.test(colorText))
  return match ? match.keywords : []
}

export function bikeDesignThemeKeywords({ mainColor, accentColor }) {
  return [...new Set([...colorToKeywords(mainColor), ...colorToKeywords(accentColor)])]
}
