import { useEffect, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '@/app/RootNavigator'
import { Button } from '@/components/Button'
import { ScreenContainer } from '@/components/ScreenContainer'
import { colors, radius, spacing, typography } from '@/theme'
import { useGenerationSession } from '@/context/GenerationSessionContext'
import { NameSuggestionChip } from './components/NameSuggestionChip'
import { saveVeria } from './saveVeria'

type Props = NativeStackScreenProps<RootStackParamList, 'Naming'>

export function NamingScreen({ navigation }: Props) {
  const { bikeInfo, answers, generatedContent, setVeria } = useGenerationSession()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bikeInfo || !generatedContent) navigation.replace('BikeRegistration')
  }, [bikeInfo, generatedContent, navigation])

  if (!bikeInfo || !generatedContent) return null

  async function handleConfirm() {
    if (!bikeInfo || !generatedContent || name.trim().length === 0) return
    setSaving(true)
    setError(null)
    try {
      const veria = await saveVeria({ bikeInfo, answers, content: generatedContent, chosenName: name.trim() })
      setVeria(veria)
      navigation.replace('Profile')
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenContainer style={{ justifyContent: 'space-between' }}>
      <View style={{ gap: spacing.lg }}>
        <Text style={typography.title}>名前をつけてあげよう</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="このヴェリアの名前"
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            padding: spacing.md,
            fontSize: 18,
            color: colors.text,
          }}
        />
        <View style={{ gap: spacing.xs }}>
          <Text style={typography.caption}>AIからの名前候補（参考）</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {generatedContent.metadata.nameCandidates.map((candidate) => (
              <NameSuggestionChip key={candidate} label={candidate} onPress={() => setName(candidate)} />
            ))}
          </View>
        </View>
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
      </View>
      <Button label="決定" onPress={handleConfirm} disabled={name.trim().length === 0} loading={saving} />
    </ScreenContainer>
  )
}
