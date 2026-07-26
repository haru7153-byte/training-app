// White-based UI with a celeste-blue accent, per the RIDEVERSE design concept.
export const colors = {
  background: '#FFFFFF',
  surface: '#F7FAFC',
  card: '#FFFFFF',
  border: '#E7EDF3',
  accent: '#5FC8E3', // チェレステブルー
  accentSoft: '#E8F7FB',
  text: '#1E2733',
  textMuted: '#7C8A99',
  textInverse: '#FFFFFF',
  success: '#6FCF97',
  danger: '#E5766B',
  overlay: 'rgba(20, 26, 33, 0.6)',
} as const

export type ColorToken = keyof typeof colors
