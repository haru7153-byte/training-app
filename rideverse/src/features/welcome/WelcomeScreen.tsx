import { Text, View } from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '@/app/RootNavigator'
import { Button } from '@/components/Button'
import { ScreenContainer } from '@/components/ScreenContainer'
import { colors, spacing, typography } from '@/theme'

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>

export function WelcomeScreen({ navigation }: Props) {
  return (
    <ScreenContainer style={{ justifyContent: 'space-between' }}>
      <View style={{ gap: spacing.md, marginTop: spacing.xxl }}>
        <Text style={typography.title}>ようこそ、RIDEVERSEへ</Text>
        <Text style={typography.body}>
          ヴェリアは、ライダーとあなたの自転車、景色、風、思い出から生まれる小さな精霊。{'\n\n'}
          ペットではなく、対等なパートナーとして、あなたと一緒に走る存在です。
        </Text>
        <Text style={[typography.body, { color: colors.accent }]}>
          あなたの自転車を教えてください。そこから、世界に一人だけのヴェリアが生まれます。
        </Text>
      </View>
      <Button label="はじめる" onPress={() => navigation.navigate('BikeRegistration')} />
    </ScreenContainer>
  )
}
