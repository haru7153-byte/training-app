import { useEffect } from 'react'
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '@/app/RootNavigator'
import { ScreenContainer } from '@/components/ScreenContainer'
import { colors, radius, spacing, typography } from '@/theme'
import { useGenerationSession } from '@/context/GenerationSessionContext'
import { ProfileField } from './components/ProfileField'

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>

export function ProfileScreen({ navigation }: Props) {
  const { veria } = useGenerationSession()

  useEffect(() => {
    if (!veria) navigation.replace('Welcome')
  }, [veria, navigation])

  if (!veria) return null

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ gap: spacing.lg, alignItems: 'center' }}>
        <Image source={{ uri: veria.imageUrl }} style={styles.image} resizeMode="cover" />
        <Text style={typography.display}>{veria.name}</Text>
        <Text style={[typography.body, { color: colors.accent, textAlign: 'center' }]}>{veria.voice.greeting}</Text>
        {/* Lightweight preview of "why this veria" — the dedicated reveal screen is planned for a later phase. */}
        <Text style={[typography.caption, { textAlign: 'center' }]}>{veria.metadata.generationReason}</Text>
        <View style={{ width: '100%', gap: spacing.md }}>
          <ProfileField label="Theme" value={`${veria.theme.summary}（${veria.theme.keywords.join(' / ')}）`} />
          <ProfileField label="種族" value={veria.species.name} />
          <ProfileField label="見た目" value={veria.appearance.description} />
          <ProfileField label="性格" value={veria.personality.description} />
          <ProfileField label="キーワード" value={veria.personality.emotionKeywords.join(' / ')} />
          <ProfileField label="話し方" value={veria.voice.tone} />
          <ProfileField label="好きなライド" value={veria.personality.favoriteRide} />
          <ProfileField label="好きな季節" value={veria.personality.favoriteSeason} />
          <ProfileField label="誕生日" value={veria.birthday} />
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  image: {
    width: 220,
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
})
