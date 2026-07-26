import { Text, View } from 'react-native'
import { spacing, typography } from '@/theme'

interface ProfileFieldProps {
  label: string
  value: string
}

export function ProfileField({ label, value }: ProfileFieldProps) {
  return (
    <View style={{ gap: spacing.xs / 2 }}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={typography.body}>{value}</Text>
    </View>
  )
}
