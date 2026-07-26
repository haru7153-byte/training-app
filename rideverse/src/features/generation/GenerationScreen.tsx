import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '@/app/RootNavigator'
import { Button } from '@/components/Button'
import { ScreenContainer } from '@/components/ScreenContainer'
import { spacing, typography } from '@/theme'
import { useGenerationSession } from '@/context/GenerationSessionContext'
import { GenerationAnimation } from './components/GenerationAnimation'
import { useVeriaGeneration } from './useVeriaGeneration'

type Props = NativeStackScreenProps<RootStackParamList, 'Generation'>

const GREETING_DELAY_MS = 1600

export function GenerationScreen({ navigation }: Props) {
  const { bikeInfo, answers, setGeneratedContent } = useGenerationSession()
  const [showGreeting, setShowGreeting] = useState(false)
  const { status, content, error, retry } = useVeriaGeneration(bikeInfo, answers)

  useEffect(() => {
    if (!bikeInfo) navigation.replace('BikeRegistration')
  }, [bikeInfo, navigation])

  useEffect(() => {
    if (status !== 'success') setShowGreeting(false)
  }, [status])

  if (!bikeInfo) return null

  function handleRevealed() {
    setTimeout(() => setShowGreeting(true), GREETING_DELAY_MS)
  }

  function handleContinue() {
    if (!content) return
    setGeneratedContent(content)
    navigation.navigate('Naming')
  }

  if (status === 'error') {
    return (
      <ScreenContainer centered style={{ gap: spacing.lg }}>
        <Text style={typography.body}>{error}</Text>
        <Button label="もう一度試す" onPress={retry} />
      </ScreenContainer>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <GenerationAnimation
        ready={status === 'success'}
        imageUrl={content?.imageUrl}
        showGreeting={showGreeting}
        onRevealed={handleRevealed}
      />
      {showGreeting && (
        <View style={{ position: 'absolute', bottom: spacing.xxl, left: spacing.lg, right: spacing.lg }}>
          <Button label="名前をつける" onPress={handleContinue} />
        </View>
      )}
    </View>
  )
}
