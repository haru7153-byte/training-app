import { Pressable, StyleSheet, Text } from 'react-native'
import { colors, radius, spacing, typography } from '@/theme'

interface ChoiceOptionProps {
  label: string
  selected: boolean
  onPress: () => void
}

export function ChoiceOption({ label, selected, onPress }: ChoiceOptionProps) {
  return (
    <Pressable style={[styles.option, selected && styles.optionSelected]} onPress={onPress}>
      <Text style={[typography.subtitle, selected && { color: colors.textInverse }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.card,
  },
  optionSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
})
