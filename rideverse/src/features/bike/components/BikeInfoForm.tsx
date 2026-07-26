import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { BikeAnalysisResult } from '../types'
import { colors, radius, spacing, typography } from '@/theme'

interface BikeInfoFormProps {
  manufacturer: string
  color: string
  onManufacturerChange: (value: string) => void
  onColorChange: (value: string) => void
  analysis: BikeAnalysisResult | null
}

function CandidateChips({ label, candidates, onSelect }: { label: string; candidates: string[]; onSelect: (v: string) => void }) {
  if (candidates.length === 0) return null
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={typography.caption}>{label}の候補（タップで入力）</Text>
      <View style={styles.chipRow}>
        {candidates.map((candidate) => (
          <Pressable key={candidate} style={styles.chip} onPress={() => onSelect(candidate)}>
            <Text style={styles.chipText}>{candidate}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

export function BikeInfoForm({ manufacturer, color, onManufacturerChange, onColorChange, analysis }: BikeInfoFormProps) {
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Text style={typography.subtitle}>メーカー</Text>
        <TextInput
          value={manufacturer}
          onChangeText={onManufacturerChange}
          placeholder="例: TREK"
          style={styles.input}
        />
        <CandidateChips label="メーカー" candidates={analysis?.manufacturerCandidates ?? []} onSelect={onManufacturerChange} />
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text style={typography.subtitle}>カラー</Text>
        <TextInput value={color} onChangeText={onColorChange} placeholder="例: マットブラック" style={styles.input} />
        <CandidateChips label="カラー" candidates={analysis?.colorCandidates ?? []} onSelect={onColorChange} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
})
