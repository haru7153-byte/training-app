// Shared knowledge base for "Velia Generation Reference v1.0". Both the
// personality/profile prompt (STEP2) and the image prompt (STEP3) import from
// here so the two independent AI calls stay aligned on the same world, the
// same bike-type -> species direction, and the same visual style — without
// depending on each other's output.

export const WORLD_VIEW = `RIDEVERSEには「ヴェリア」という小さな精霊が存在する。
ヴェリアはライダー・自転車・景色・風・思い出から生まれる存在で、ライダーとは対等なパートナーであり、ペットではない。
Veliaはランダムなキャラクターではなく、「その人」と「その自転車」から生まれる唯一の相棒。生成結果は毎回異なってよいが、同じ入力なら世界観・性格・デザインの方向性は一貫させること。`

// Bike Type -> 方向性（キーワード・候補種族）。カテゴリごとの世界観の軸。
export const BIKE_TYPE_DIRECTIONS = {
  road: { label: 'Road', keywords: ['風', 'スピード', '軽快', '爽快感'], candidateSpecies: ['Wolf', 'Fox', 'Falcon', 'Cat'] },
  mtb: { label: 'MTB', keywords: ['自然', '冒険', '力強い'], candidateSpecies: ['Bear', 'Wolf', 'Dog', 'Goat'] },
  gravel: { label: 'Gravel', keywords: ['探検', '自由', 'ロングライド'], candidateSpecies: ['Fox', 'Wolf', 'Deer'] },
  mini_velo: { label: 'Mini Velo', keywords: ['街', 'かわいい', 'カフェ'], candidateSpecies: ['Rabbit', 'Squirrel', 'Cat'] },
  mamachari: { label: 'Mamachari', keywords: ['日常', '優しい', '安心感'], candidateSpecies: ['Dog', 'Capybara', 'Rabbit'] },
  unknown: { label: 'Unknown', keywords: ['風', '自由'], candidateSpecies: ['Wolf', 'Fox', 'Rabbit', 'Dog'] },
}

export function bikeTypeDirectionText(bikeType) {
  const dir = BIKE_TYPE_DIRECTIONS[bikeType] || BIKE_TYPE_DIRECTIONS.unknown
  return `Bike Type "${dir.label}" の方向性 — キーワード: ${dir.keywords.join('・')} / 候補種族: ${dir.candidateSpecies.join(', ')}（種族はこの候補群から選ぶか、方向性に沿う近い種族にすること。メーカー名だけで種族を決めないこと）`
}

// 各入力がヴェリア生成に与える影響度の目安。数式ではなく、モデルへの重み付けの指針として渡す。
export const GENERATION_WEIGHTS_NOTE = `影響度の目安: Bike Type 35% / 質問回答 35% / 自転車デザイン(色・フレーム・ホイール) 20% / ランダムな個性 10%。
ランダム要素は完全一致を防ぐための微調整のみに使い、性格や種族の大枠を覆さないこと（10%以内の影響に留める）。`

export const GENERATION_ORDER_NOTE = `生成順序（この順で考えてから最終JSONを出力すること）:
Bike Type -> 基本性格 -> 質問回答による性格補正 -> カラー(メイン/差し色) -> 装備 -> 表情 -> Velia完成`

export const PERSONALITY_EXAMPLES = `性格生成の例:
- 「競争好き」の回答が多い -> 負けず嫌い -> 応援が熱いキャラクターになりやすい
- 「カフェ好き」「のんびり派」の回答が多い -> 穏やか -> 癒し系のキャラクターになりやすい
これらは一例であり、実際の回答の組み合わせに応じて自然な性格を導くこと。`

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

// STEP3 画像生成プロンプトの必須要件（positive）。
export const IMAGE_POSITIVE_REQUIREMENTS = [
  'Cute cycling companion',
  '2.5 head ratio',
  'Large expressive eyes',
  'Human hands',
  'Human feet',
  'Animal ears',
  'Animal tail',
  'Cycling jersey',
  'Cycling gloves',
  'Road cycling shoes',
  'White background',
  'Soft anime illustration',
  'Official game concept art',
  'Pastel colors',
  'Friendly smile',
  'Front view',
  'Full body',
  'Standing pose',
]

// STEP3 画像生成プロンプトの禁止要件（negative）。
export const IMAGE_NEGATIVE_PROMPT = [
  'No weapon',
  'No armor',
  'No monster',
  'No horror',
  'No realistic fur',
  'No text',
  'No logo',
  'No watermark',
  'No scenery or props in the background (plain white background only)',
]

// 公式ヴェリア1号機「リヴェラ」は rideverse/design/official-velia-001-reference.png に
// 実データを保存済み（複数ポーズ・表情・設定表を含む1枚のリファレンスシート）。
// OpenAI Images generations API はテキストのみのプロンプトで、シート画像そのものを
// スタイル参照として渡すには images.edit（画像入力）が必要だが、このシートは表や
// 日本語ラベルを含む複合画像のため、そのまま渡すとキャラクター以外の要素（表・文字）を
// 誤って再現するリスクが高い。そのため現時点ではシート自体を画像生成APIには渡さず、
// その視覚的特徴を以下のテキスト記述として反映する運用にしている。
// 将来的に「正面立ち絵のみを切り出した参照画像」を用意できれば、
// openaiClient.js に images.edit 呼び出しを追加して画風の直接継承に切り替えられる。
export const OFFICIAL_REFERENCE_STYLE_NOTE = `公式ヴェリア1号機「リヴェラ(Riviera)」のデザイン言語に準拠すること:
- 灰〜シルバーがかった毛並みに、青系のジャージとゴーグル
- 大きな紫がかった瞳、丸みのあるシルエット、2.5頭身のSDプロポーション
- 柔らかい陰影のアニメ塗り、パステル寄りの配色
- 表情は基本的に明るく親しみやすい笑顔`
