import { useEffect, useRef, useState } from 'react'
import { Animated, Image, StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '@/theme'
import { GenerationAnimationStage } from '../types'

const STAGE_ORDER: GenerationAnimationStage[] = ['blackout', 'light', 'wind', 'colorMix']
const STAGE_DURATION_MS = 900

interface GenerationAnimationProps {
  /** true once both AI calls have resolved — allowed to move past the looping stages into reveal. */
  ready: boolean
  imageUrl?: string
  showGreeting: boolean
  onRevealed?: () => void
}

/**
 * Pure presentation of the "誕生" sequence: 暗転 -> 光 -> 風 -> 色が混ざる -> ヴェリア誕生.
 * Kept separate from useVeriaGeneration so the visuals can be swapped/enhanced later
 * (e.g. Lottie) without touching the AI orchestration.
 */
export function GenerationAnimation({ ready, imageUrl, showGreeting, onRevealed }: GenerationAnimationProps) {
  const [stageIndex, setStageIndex] = useState(0)
  const revealed = stageIndex >= STAGE_ORDER.length - 1 && ready
  const layerOpacities = useRef(STAGE_ORDER.map(() => new Animated.Value(0))).current
  const revealOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (stageIndex >= STAGE_ORDER.length - 1) return
    const timer = setTimeout(() => setStageIndex((i) => i + 1), STAGE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [stageIndex])

  useEffect(() => {
    const activeIndex = Math.min(stageIndex, STAGE_ORDER.length - 1)
    layerOpacities.forEach((value, i) => {
      Animated.timing(value, { toValue: i === activeIndex ? 1 : 0, duration: 400, useNativeDriver: true }).start()
    })
  }, [stageIndex, layerOpacities])

  useEffect(() => {
    if (revealed) {
      Animated.timing(revealOpacity, { toValue: 1, duration: 700, useNativeDriver: true }).start()
      onRevealed?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed])

  return (
    <View style={styles.stage}>
      <Animated.View style={[styles.layer, styles.blackout, { opacity: layerOpacities[0] }]} />
      <Animated.View style={[styles.layer, styles.light, { opacity: layerOpacities[1] }]} />
      <Animated.View style={[styles.layer, styles.wind, { opacity: layerOpacities[2] }]} />
      <Animated.View style={[styles.layer, styles.colorMix, { opacity: layerOpacities[3] }]} />

      {revealed && (
        <Animated.View style={[styles.reveal, { opacity: revealOpacity }]}>
          {imageUrl && <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />}
          {showGreeting && <Text style={[typography.title, { marginTop: spacing.lg }]}>こんにちは！</Text>}
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  layer: { ...StyleSheet.absoluteFillObject },
  blackout: { backgroundColor: '#000000' },
  light: { backgroundColor: '#FFFFFF' },
  wind: { backgroundColor: colors.accentSoft },
  colorMix: { backgroundColor: colors.accent },
  reveal: { alignItems: 'center', justifyContent: 'center' },
  image: { width: 220, height: 220 },
})
