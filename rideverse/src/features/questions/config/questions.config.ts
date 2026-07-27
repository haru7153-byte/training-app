import { QuestionDefinition } from '../types'

// Add, remove, or reorder entries here to change the interview — QuestionsScreen
// renders purely from this array, so question count/content never needs a code
// change. Velia Generation Reference v1.0 calls for 8〜10 questions; these 10
// match the reference's example list. Option ids here are looked up by
// api/rideverse/_lib/answerThemeMap.js — keep the two in sync when editing.
export const QUESTIONS: QuestionDefinition[] = [
  {
    id: 'ridePurpose',
    prompt: 'ライドの目的は？',
    type: 'single-choice',
    options: [
      { id: 'hill_climb', label: 'ヒルクライム' },
      { id: 'cafe_ride', label: 'カフェライド' },
      { id: 'race', label: 'レース' },
      { id: 'commute', label: '通勤' },
      { id: 'long_ride', label: 'ロングライド' },
    ],
  },
  {
    id: 'favoriteScenery',
    prompt: '好きな景色は？',
    type: 'single-choice',
    options: [
      { id: 'sea', label: '海沿い' },
      { id: 'mountain', label: '山・高原' },
      { id: 'city', label: '街並み' },
      { id: 'countryside', label: '田園風景' },
    ],
  },
  {
    id: 'favoriteSeason',
    prompt: '好きな季節は？',
    type: 'single-choice',
    options: [
      { id: 'spring', label: '春' },
      { id: 'summer', label: '夏' },
      { id: 'autumn', label: '秋' },
      { id: 'winter', label: '冬' },
    ],
  },
  {
    id: 'rideTime',
    prompt: 'よく走る時間帯は？',
    type: 'single-choice',
    options: [
      { id: 'early_morning', label: '早朝' },
      { id: 'daytime', label: '日中' },
      { id: 'evening', label: '夕方' },
      { id: 'night', label: '夜' },
    ],
  },
  {
    id: 'personality',
    prompt: 'あなたの性格に近いのは？',
    type: 'single-choice',
    options: [
      { id: 'gentle', label: '優しい' },
      { id: 'energetic', label: '元気いっぱい' },
      { id: 'cool_calm', label: 'クール' },
      { id: 'mischievous', label: 'いたずら好き' },
    ],
  },
  {
    id: 'challengeOriented',
    prompt: 'チャレンジ派？',
    type: 'single-choice',
    options: [
      { id: 'very', label: 'とてもそう' },
      { id: 'somewhat', label: 'まあまあ' },
      { id: 'a_little', label: 'あまり' },
      { id: 'no', label: 'いいえ' },
    ],
  },
  {
    id: 'relaxedOriented',
    prompt: 'のんびり派？',
    type: 'single-choice',
    options: [
      { id: 'very', label: 'とてもそう' },
      { id: 'somewhat', label: 'まあまあ' },
      { id: 'a_little', label: 'あまり' },
      { id: 'no', label: 'いいえ' },
    ],
  },
  {
    id: 'raceOriented',
    prompt: 'レース志向？',
    type: 'single-choice',
    options: [
      { id: 'very', label: 'とてもそう' },
      { id: 'somewhat', label: 'まあまあ' },
      { id: 'a_little', label: 'あまり' },
      { id: 'no', label: 'いいえ' },
    ],
  },
  {
    id: 'cafeLover',
    prompt: 'カフェ好き？',
    type: 'single-choice',
    options: [
      { id: 'love', label: '大好き' },
      { id: 'like', label: '好き' },
      { id: 'neutral', label: 'どちらでもない' },
      { id: 'not_much', label: 'あまり' },
    ],
  },
  {
    id: 'soloOrGroup',
    prompt: '一人派？仲間派？',
    type: 'single-choice',
    options: [
      { id: 'solo', label: '一人が好き' },
      { id: 'group', label: '仲間とが好き' },
      { id: 'both', label: 'どちらも好き' },
    ],
  },
]
