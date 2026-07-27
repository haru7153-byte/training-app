import { useState } from 'react'
import { ScrollView, Text } from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '@/app/RootNavigator'
import { Button } from '@/components/Button'
import { ScreenContainer } from '@/components/ScreenContainer'
import { spacing, typography } from '@/theme'
import { useGenerationSession } from '@/context/GenerationSessionContext'
import { analyzeBikePhoto } from '@/services/ai/vision/analyzeBikePhoto'
import { BikePhotoPicker } from './components/BikePhotoPicker'
import { BikeInfoForm, BikeFormFields } from './components/BikeInfoForm'

type Props = NativeStackScreenProps<RootStackParamList, 'BikeRegistration'>

const EMPTY_FIELDS: BikeFormFields = {
  bikeType: 'unknown',
  manufacturer: '',
  model: '',
  mainColor: '',
  accentColor: '',
  wheelDepth: '',
  frameStyle: '',
}

/** The Vision step returns "unknown" instead of guessing — treat that as "needs manual input". */
function clearUnknown(value: string): string {
  return value === 'unknown' ? '' : value
}

export function BikeRegistrationScreen({ navigation }: Props) {
  const { setBikeInfo } = useGenerationSession()
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [fields, setFields] = useState<BikeFormFields>(EMPTY_FIELDS)
  const [analyzing, setAnalyzing] = useState(false)

  async function handlePicked(photo: { uri: string; base64: string }) {
    setPhotoUri(photo.uri)
    setAnalyzing(true)
    try {
      const result = await analyzeBikePhoto(photo.base64)
      setFields({
        bikeType: result.bikeType,
        manufacturer: clearUnknown(result.manufacturer),
        model: clearUnknown(result.model),
        mainColor: clearUnknown(result.mainColor),
        accentColor: clearUnknown(result.accentColor),
        wheelDepth: clearUnknown(result.wheelDepth),
        frameStyle: clearUnknown(result.frameStyle),
      })
    } catch {
      // AI analysis is an assist only — the rider can still fill the form by hand.
    } finally {
      setAnalyzing(false)
    }
  }

  const canProceed =
    photoUri !== null &&
    fields.bikeType !== 'unknown' &&
    fields.manufacturer.trim().length > 0 &&
    fields.mainColor.trim().length > 0

  function handleNext() {
    if (!photoUri) return
    setBikeInfo({
      photoUri,
      bikeType: fields.bikeType,
      manufacturer: fields.manufacturer.trim(),
      model: fields.model.trim() || 'unknown',
      mainColor: fields.mainColor.trim(),
      accentColor: fields.accentColor.trim() || 'unknown',
      wheelDepth: fields.wheelDepth.trim() || 'unknown',
      frameStyle: fields.frameStyle.trim() || 'unknown',
    })
    navigation.navigate('Questions')
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <Text style={typography.title}>自転車を登録</Text>
        <Text style={typography.caption}>あなたの相棒の自転車を撮影・選択してください</Text>
        <BikePhotoPicker photoUri={photoUri} onPicked={handlePicked} disabled={analyzing} />
        {analyzing && <Text style={typography.caption}>AIが自転車を解析しています...</Text>}
        <BikeInfoForm fields={fields} onChange={(patch) => setFields((prev) => ({ ...prev, ...patch }))} />
        <Button label="次へ" onPress={handleNext} disabled={!canProceed} />
      </ScrollView>
    </ScreenContainer>
  )
}
