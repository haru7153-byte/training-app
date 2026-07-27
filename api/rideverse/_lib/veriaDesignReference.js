// Shared knowledge base for "Velia Generation Reference v1.1". STEP2
// (personality/theme) and STEP3 (image) both import from here so the two
// independent AI calls stay aligned on the same world, the same generation
// order (BikeType -> Theme -> Species -> Personality -> Appearance), and the
// same visual style — without depending on each other's implementation.

export const WORLD_VIEW = `RIDEVERSEには「ヴェリア」という小さな精霊が存在する。
ヴェリアはライダー・自転車・景色・風・思い出から生まれる存在で、ライダーとは対等なパートナーであり、ペットではない。
Veliaはランダムなキャラクターではなく、「その人」と「その自転車」から生まれる唯一の相棒。生成結果は毎回異なってよいが、同じ入力なら世界観・性格・デザインの方向性は一貫させること。`

// Bike Type -> Theme（キーワード・候補種族）。Themeを世界観の中心に置き、
// Species は Theme から導出する（BikeType -> Theme -> Species -> Personality -> Appearance）。
export const BIKE_TYPE_DIRECTIONS = {
  road: { label: 'Road', themeKeywords: ['風', '自由', '空', '爽快感'], candidateSpecies: ['Wolf', 'Fox', 'Falcon'] },
  mtb: { label: 'MTB', themeKeywords: ['自然', '冒険', '力強さ'], candidateSpecies: ['Bear', 'Wolf', 'Dog'] },
  gravel: { label: 'Gravel', themeKeywords: ['探検', '旅', 'ロングライド'], candidateSpecies: ['Fox', 'Wolf', 'Deer'] },
  mini_velo: { label: 'Mini Velo', themeKeywords: ['街', 'カフェ', 'かわいい'], candidateSpecies: ['Rabbit', 'Cat', 'Squirrel'] },
  mamachari: { label: 'Mamachari', themeKeywords: ['日常', '安心', '優しさ'], candidateSpecies: ['Dog', 'Rabbit', 'Capybara'] },
  unknown: { label: 'Unknown', themeKeywords: ['風', '自由'], candidateSpecies: ['Wolf', 'Fox', 'Rabbit', 'Dog'] },
}

export function bikeTypeDirection(bikeType) {
  return BIKE_TYPE_DIRECTIONS[bikeType] || BIKE_TYPE_DIRECTIONS.unknown
}

export function bikeTypeDirectionText(bikeType) {
  const dir = bikeTypeDirection(bikeType)
  return `Bike Type "${dir.label}" のTheme方向性 — Themeキーワード候補: ${dir.themeKeywords.join('・')} / Species候補: ${dir.candidateSpecies.join(', ')}（Speciesはこの候補群から選ぶか、決定したThemeに沿う近い種族にすること。メーカー名だけでSpeciesを決めないこと）`
}

// 各入力がヴェリア生成に与える影響度の目安。数式ではなく、モデルへの重み付けの指針として渡す。
export const GENERATION_WEIGHTS_NOTE = `影響度の目安（Themeの決定に使う）: Bike Type 35% / 質問回答から変換したThemeキーワード 35% / 自転車デザイン(色・フレーム・ホイール) 20% / ランダムな個性 10%。
ランダム要素は完全一致を防ぐための微調整のみに使い、Theme・Species・性格の大枠を覆さないこと（10%以内の影響に留める）。`

export const GENERATION_ORDER_NOTE = `生成順序（必ずこの順で考えてから最終JSONを出力すること。Appearanceを先に決めないこと）:
1. BikeType -> Theme（このヴェリアの世界観・方向性を決める。keywordsとsummary）
2. Theme -> Species（Bike Typeの候補種族とThemeに沿って決める）
3. Theme + Species + 質問由来のThemeキーワード -> Emotion Keywords（性格を表す短い単語を3〜5個）
4. Emotion Keywords -> Personality（性格の説明文。favoriteRide/favoriteSeasonもここで決める）
5. Species + Personality + Theme + MainColor + AccentColor -> Appearance（最後に見た目を文章化する）
6. Species + Personality -> Voice（話し方・挨拶）`

export const PERSONALITY_EXAMPLES = `Emotion Keywords -> Personality の例:
- Brave, Cheerful, Curious のような組み合わせ -> 好奇心旺盛で明るく、少し向こう見ずな性格になりやすい
- Calm, Kind, Reliable のような組み合わせ -> 穏やかで面倒見が良く、安心感のある性格になりやすい
これらは一例であり、実際のThemeとSpeciesの組み合わせに応じて自然な性格を導くこと。`

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

// Style DNA — every image generation call must include this block verbatim.
// This is the single biggest lever for character-generation quality/consistency,
// so it is never conditional or trimmed.
export const STYLE_DNA = [
  'Super Deformed Character',
  '2.5 head ratio',
  'Cute mascot style',
  'Large head',
  'Large expressive eyes',
  'Round silhouette',
  'Soft anime illustration',
  'Thin clean line art',
  'Pastel color palette',
  'Human hands',
  'Human feet',
  'Animal ears',
  'Animal tail',
  'Cycling jersey',
  'Cycling shorts',
  'Cycling gloves',
  'Road cycling shoes',
  'Official game concept art',
  'White background',
  'Standing pose, holding the bicycle with one hand',
  'Front view',
  'No realistic anatomy',
  'No muscular body',
  'No long legs',
  'No realistic proportions',
]

export const SD_PROPORTION_MANDATE = `最重要条件: 必ずSDキャラクターにすること。現在よりさらに頭を大きく、体を小さくすること。公式ヴェリア1号機「リヴェラ」の頭身・可愛さを基準とすること。`

// STEP3 画像生成プロンプトの禁止要件（negative）。Style DNA内の "No ..." 項目とは別に、
// 武器・ホラー要素など明確に禁止したい項目をここで管理する。
// 注意: 自転車自体はキャラクターが片手で持つ必須の被写体であり、ここでいう
// 「背景の小道具」には含まれない（背景そのものは引き続きプレーンな白にする）。
export const IMAGE_NEGATIVE_PROMPT = [
  'No weapon',
  'No armor',
  'No monster',
  'No horror',
  'No realistic fur',
  'No text',
  'No logo',
  'No watermark',
  'No background scenery or extra props (plain white background only — the bicycle held by the character is required and is not an excluded prop)',
]

// 公式ヴェリア1号機「リヴェラ」は rideverse/design/official-velia-002-reference.png に
// 実データを保存済み（複数ポーズ・表情・設定表を含む1枚のリファレンスシート。v002で
// 自転車を片手に持つポーズに更新）。
// OpenAI Images generations API はテキストのみのプロンプトで、シート画像そのものを
// スタイル参照として渡すには images.edit（画像入力）が必要だが、このシートは表や
// 日本語ラベルを含む複合画像のため、そのまま渡すとキャラクター以外の要素（表・文字）を
// 誤って再現するリスクが高い。そのため現時点ではシート自体を画像生成APIには渡さず、
// その視覚的特徴（特に頭身・可愛さの基準、自転車の持ち方）を以下のテキスト記述として
// 反映する運用にしている。
// 将来的に「正面立ち絵のみを切り出した参照画像」を用意できれば、
// openaiClient.js に images.edit 呼び出しを追加して画風の直接継承に切り替えられる。
export const OFFICIAL_REFERENCE_STYLE_NOTE = `公式ヴェリア1号機「リヴェラ(Riviera)」のデザイン言語・頭身・可愛さを基準とすること:
- 灰〜シルバーがかった毛並みに、青系のジャージとゴーグル
- 大きな紫がかった瞳、丸みのあるシルエット、2.5頭身のSDプロポーション（頭が大きく体が小さい）
- 柔らかい陰影のアニメ塗り、パステル寄りの配色
- 表情は基本的に明るく親しみやすい笑顔
- 自転車のハンドルを片手で持ち、自転車と並んで立つポーズ（v002リファレンス準拠）`
