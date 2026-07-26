import * as ImagePicker from 'expo-image-picker'
import { Image, StyleSheet, Text, View } from 'react-native'
import { Button } from '@/components/Button'
import { colors, radius, spacing, typography } from '@/theme'

interface PickedPhoto {
  uri: string
  base64: string
}

interface BikePhotoPickerProps {
  photoUri: string | null
  onPicked: (photo: PickedPhoto) => void
  disabled?: boolean
}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.6,
  base64: true,
}

export function BikePhotoPicker({ photoUri, onPicked, disabled }: BikePhotoPickerProps) {
  async function handleResult(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) return
    const asset = result.assets[0]
    if (!asset.base64) return
    onPicked({ uri: asset.uri, base64: `data:image/jpeg;base64,${asset.base64}` })
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) return
    await handleResult(await ImagePicker.launchCameraAsync(PICKER_OPTIONS))
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return
    await handleResult(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS))
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.preview}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <Text style={typography.caption}>自転車の写真がまだありません</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button label="写真を撮る" variant="secondary" onPress={takePhoto} disabled={disabled} style={{ flex: 1 }} />
        <Button label="写真を選ぶ" variant="secondary" onPress={pickFromLibrary} disabled={disabled} style={{ flex: 1 }} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  preview: {
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
})
