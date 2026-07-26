import { useEffect, useRef } from 'react'
import { Animated, Pressable, Text } from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '@/app/RootNavigator'
import { ScreenContainer } from '@/components/ScreenContainer'
import { colors, spacing, typography } from '@/theme'

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>

const AUTO_ADVANCE_MS = 2600

export function SplashScreen({ navigation }: Props) {
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }).start()
    const timer = setTimeout(() => navigation.replace('Welcome'), AUTO_ADVANCE_MS)
    return () => clearTimeout(timer)
  }, [navigation, opacity])

  return (
    <Pressable style={{ flex: 1 }} onPress={() => navigation.replace('Welcome')}>
      <ScreenContainer centered>
        <Animated.View style={{ opacity, alignItems: 'center', gap: spacing.sm }}>
          <Text style={[typography.display, { color: colors.accent }]}>RIDEVERSE</Text>
          <Text style={[typography.body, { textAlign: 'center' }]}>
            風と、景色と、思い出から生まれる{'\n'}小さな精霊「ヴェリア」の物語
          </Text>
        </Animated.View>
      </ScreenContainer>
    </Pressable>
  )
}
