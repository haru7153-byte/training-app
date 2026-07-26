import { useState } from 'react'
import { ScrollView, Text } from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '@/app/RootNavigator'
import { Button } from '@/components/Button'
import { ScreenContainer } from '@/components/ScreenContainer'
import { spacing, typography } from '@/theme'
import { useGenerationSession } from '@/context/GenerationSessionContext'
import { analyzeBikePhoto } from '@/services/ai/vision/analyzeBikePhoto'
import { BikeAnalysisResult } from './types'
import { BikePhotoPicker } from './components/BikePhotoPicker'
import { BikeInfoForm } from './components/BikeInfoForm'

type Props = NativeStackScreenProps<RootStackParamList, 'BikeRegistration'>

export function BikeRegistrationScreen({ navigation }: Props) {
  const { setBikeInfo } = useGenerationSession()
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [manufacturer, setManufacturer] = useState('')
  const [color, setColor] = useState('')
  const [analysis, setAnalysis] = useState<BikeAnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  async function handlePicked(photo: { uri: string; base64: string }) {
    setPhotoUri(photo.uri)
    setAnalysis(null)
    setAnalyzing(true)
    try {
      const result = await analyzeBikePhoto(photo.base64)
      setAnalysis(result)
      if (result.manufacturerCandidates[0]) setManufacturer(result.manufacturerCandidates[0])
      if (result.colorCandidates[0]) setColor(result.colorCandidates[0])
    } catch {
      // AI analysis is an assist only — the rider can still fill the form by hand.
    } finally {
      setAnalyzing(false)
    }
  }

  const canProceed = photoUri !== null && manufacturer.trim().length > 0 && color.trim().length > 0

  function handleNext() {
    if (!photoUri) return
    setBikeInfo({ photoUri, manufacturer: manufacturer.trim(), color: color.trim() })
    navigation.navigate('Questions')
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <Text style={typography.title}>自転車を登録</Text>
        <Text style={typography.caption}>あなたの相棒の自転車を撮影・選択してください</Text>
        <BikePhotoPicker photoUri={photoUri} onPicked={handlePicked} disabled={analyzing} />
        {analyzing && <Text style={typography.caption}>AIが自転車を解析しています...</Text>}
        <BikeInfoForm
          manufacturer={manufacturer}
          color={color}
          onManufacturerChange={setManufacturer}
          onColorChange={setColor}
          analysis={analysis}
        />
        <Button label="次へ" onPress={handleNext} disabled={!canProceed} />
      </ScrollView>
    </ScreenContainer>
  )
}
