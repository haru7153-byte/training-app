import { QuestionDefinition } from '../types'

// Add, remove, or reorder entries here to change the interview — QuestionsScreen
// renders purely from this array, so question count/content never needs a code change.
export const QUESTIONS: QuestionDefinition[] = [
  {
    id: 'rideStyle',
    prompt: 'あなたのライドスタイルは？',
    type: 'single-choice',
    options: [
      { id: 'long_ride', label: 'ロングライド' },
      { id: 'hill_climb', label: 'ヒルクライム' },
      { id: 'race', label: 'レース・TT' },
      { id: 'casual', label: 'のんびりポタリング' },
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
    id: 'favoriteColor',
    prompt: '好きな色は？',
    type: 'single-choice',
    options: [
      { id: 'blue', label: 'ブルー' },
      { id: 'green', label: 'グリーン' },
      { id: 'pink', label: 'ピンク' },
      { id: 'yellow', label: 'イエロー' },
      { id: 'white', label: 'ホワイト' },
    ],
  },
  {
    id: 'cuteOrCool',
    prompt: 'かわいい？かっこいい？',
    type: 'single-choice',
    options: [
      { id: 'cute', label: 'かわいい' },
      { id: 'cool', label: 'かっこいい' },
      { id: 'both', label: 'どちらも' },
    ],
  },
  {
    id: 'personality',
    prompt: 'どんな性格がいい？',
    type: 'single-choice',
    options: [
      { id: 'gentle', label: '優しい' },
      { id: 'energetic', label: '元気いっぱい' },
      { id: 'cool_calm', label: 'クール' },
      { id: 'mischievous', label: 'いたずら好き' },
    ],
  },
  {
    id: 'genderPreference',
    prompt: '性別の希望は？',
    type: 'single-choice',
    options: [
      { id: 'male', label: '男の子' },
      { id: 'female', label: '女の子' },
      { id: 'random', label: 'おまかせ' },
    ],
  },
]
