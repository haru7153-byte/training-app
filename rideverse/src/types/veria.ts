/** Theme is the center of the world — decided first, before Species. Reused later for events/seasons/story generation. */
export interface ThemeInfo {
  keywords: string[]
  summary: string
}

export interface SpeciesInfo {
  name: string
}

/** Personality is built from emotionKeywords first, then the description text is written from them. */
export interface PersonalityInfo {
  emotionKeywords: string[]
  description: string
  favoriteRide: string
  favoriteSeason: string
}

/** Decided last — from species + personality + theme + main/accent color. */
export interface AppearanceInfo {
  description: string
}

export interface VoiceInfo {
  tone: string
  greeting: string
}

export interface VeriaMetadata {
  nameCandidates: string[]
  /** One or two sentences explaining why this theme/species emerged from the rider's answers — groundwork for a future "why this Velia" reveal screen. */
  generationReason: string
}

/** AIが生成する、名付け前のヴェリアの中身。STEP2(文章: theme/species/personality/appearance/voice/metadata)とSTEP3(画像)は独立したAPIから届く。 */
export interface GeneratedVeriaContent {
  theme: ThemeInfo
  species: SpeciesInfo
  personality: PersonalityInfo
  appearance: AppearanceInfo
  voice: VoiceInfo
  metadata: VeriaMetadata
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

// Out of scope for the MVP — spec only, no implementation. Keep as TODOs so the
// future work is visible without carrying dead code:
// TODO(future): 感情システム — emotion system beyond static emotionKeywords (mood that changes over time/rides)
// TODO(future): 進化 — growth/evolution of the veria over time
// TODO(future): モーション変化 — idle/ride/sprint motion states
// TODO(future): 表情追加 — additional facial expressions beyond the base portrait
// TODO(future): 会話学習 — conversational learning / memory between sessions
// TODO(future): 季節イベント — seasonal events (would consume ThemeInfo)
// TODO(future): 部屋 — a home/room for the veria
// TODO(future): 家具 — furniture/decoration for the room
