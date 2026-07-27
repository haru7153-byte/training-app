// Converts a raw question answer (option id) into Theme Keywords *before* it
// reaches the AI — the model never sees the raw Japanese option labels, only
// the derived meaning. Keep option ids in sync with
// rideverse/src/features/questions/config/questions.config.ts.
export const ANSWER_THEME_MAP = {
  ridePurpose: {
    hill_climb: ['Challenge', 'Persistence', 'Growth'],
    cafe_ride: ['Healing', 'Relax', 'Kindness'],
    race: ['Competitive', 'Passion', 'Speed'],
    commute: ['Daily', 'Reliable', 'Supportive'],
    long_ride: ['Adventure', 'Freedom', 'Journey'],
  },
  favoriteScenery: {
    sea: ['Freedom', 'Openness', 'Calm'],
    mountain: ['Challenge', 'Nature', 'Strength'],
    city: ['Energy', 'Style', 'Curiosity'],
    countryside: ['Peace', 'Nostalgia', 'Warmth'],
  },
  favoriteSeason: {
    spring: ['Freshness', 'Hope', 'Playful'],
    summer: ['Energy', 'Passion', 'Bright'],
    autumn: ['Calm', 'Nostalgia', 'Warmth'],
    winter: ['Quiet', 'Resilience', 'Cozy'],
  },
  rideTime: {
    early_morning: ['Fresh', 'Clarity', 'Determination'],
    daytime: ['Bright', 'Active', 'Social'],
    evening: ['Calm', 'Reflective', 'Warm'],
    night: ['Mystery', 'Independent', 'Cool'],
  },
  personality: {
    gentle: ['Kind', 'Gentle', 'Calm'],
    energetic: ['Cheerful', 'Energetic', 'Bold'],
    cool_calm: ['Cool', 'Composed', 'Confident'],
    mischievous: ['Playful', 'Curious', 'Cheeky'],
  },
  challengeOriented: {
    very: ['Challenge', 'Ambition'],
    somewhat: ['Challenge'],
  },
  relaxedOriented: {
    very: ['Relax', 'Calm'],
    somewhat: ['Relax'],
  },
  raceOriented: {
    very: ['Competitive', 'Speed'],
    somewhat: ['Competitive'],
  },
  cafeLover: {
    love: ['Healing', 'Cozy'],
    like: ['Healing'],
  },
  soloOrGroup: {
    solo: ['Independent', 'Focused'],
    group: ['Supportive', 'Social'],
    both: ['Balanced', 'Adaptable'],
  },
}

/** Flattens the rider's answers into a deduped list of Theme Keywords. Unmapped/weak answers contribute nothing. */
export function answersToThemeKeywords(answers) {
  const keywords = []
  for (const [questionId, optionId] of Object.entries(answers || {})) {
    const matched = ANSWER_THEME_MAP[questionId]?.[optionId]
    if (matched) keywords.push(...matched)
  }
  return [...new Set(keywords)]
}
