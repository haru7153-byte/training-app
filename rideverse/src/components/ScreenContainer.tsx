import { ReactNode } from 'react'
import { StyleSheet, View, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, spacing } from '@/theme'

interface ScreenContainerProps {
  children: ReactNode
  style?: ViewStyle
  centered?: boolean
}

export function ScreenContainer({ children, style, centered }: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.content, centered && styles.centered, style]}>{children}</View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg },
  centered: { justifyContent: 'center', alignItems: 'center' },
})
