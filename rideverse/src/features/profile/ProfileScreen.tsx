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
        <View style={{ width: '100%', gap: spacing.md }}>
          <ProfileField label="種族" value={veria.species} />
          <ProfileField label="属性" value={`${veria.attributes.element} / ${veria.attributes.colorTheme}`} />
          <ProfileField label="性格" value={veria.personality} />
          <ProfileField label="紹介文" value={veria.introduction} />
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
