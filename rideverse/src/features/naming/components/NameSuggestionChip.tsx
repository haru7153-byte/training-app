import { Pressable, StyleSheet, Text } from 'react-native'
import { colors, radius, spacing } from '@/theme'

interface NameSuggestionChipProps {
  label: string
  onPress: () => void
}

export function NameSuggestionChip({ label, onPress }: NameSuggestionChipProps) {
  return (
    <Pressable style={styles.chip} onPress={onPress}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  text: { color: colors.accent, fontWeight: '600' },
})
