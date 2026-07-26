export interface VeriaAttributes {
  /** ファンタジー属性。例: 「風」「森」「水」 */
  element: string
  /** 色テーマ。例: 「セレステブルー」 */
  colorTheme: string
}

/** AIが生成する、名付け前のヴェリアの中身。画像生成と文章生成は別APIから独立して届く。 */
export interface GeneratedVeriaContent {
  imageUrl: string
  species: string
  attributes: VeriaAttributes
  personality: string
  introduction: string
  nameCandidates: string[]
}

/** 名付け・保存後の完成したヴェリア。 */
export interface Veria extends GeneratedVeriaContent {
  id: string
  name: string
  birthday: string // ISO date (YYYY-MM-DD)
  ownerId: string
  createdAt: string
}
