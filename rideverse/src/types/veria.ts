/** AIが生成する、名付け前のヴェリアの中身。文章生成(STEP2)と画像生成(STEP3)は別APIから独立して届く。 */
export interface GeneratedVeriaContent {
  species: string
  appearance: string
  personality: string
  keywords: string[]
  voiceTone: string
  greeting: string
  favoriteRide: string
  favoriteSeason: string
  nameCandidates: string[]
  imageUrl: string
  /** STEP3で実際に使われた画像生成プロンプト。再現性のため保存する。 */
  imagePrompt: string
}

/** 名付け・保存後の完成したヴェリア。 */
export interface Veria extends GeneratedVeriaContent {
  id: string
  name: string
  birthday: string // ISO date (YYYY-MM-DD)
  ownerId: string
  createdAt: string
}
