import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { BikeType, BIKE_TYPES } from '../types'
import { colors, radius, spacing, typography } from '@/theme'

export interface BikeFormFields {
  bikeType: BikeType
  manufacturer: string
  model: string
  mainColor: string
  accentColor: string
  wheelDepth: string
  frameStyle: string
}

interface BikeInfoFormProps {
  fields: BikeFormFields
  onChange: (patch: Partial<BikeFormFields>) => void
}

function FieldInput({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={typography.subtitle}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder ?? '未入力（AIが解析できませんでした）'} style={styles.input} />
    </View>
  )
}

export function BikeInfoForm({ fields, onChange }: BikeInfoFormProps) {
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <Text style={typography.subtitle}>Bike Type</Text>
        <View style={styles.chipRow}>
          {BIKE_TYPES.map((type) => (
            <Pressable
              key={type.id}
              style={[styles.chip, fields.bikeType === type.id && styles.chipSelected]}
              onPress={() => onChange({ bikeType: type.id })}
            >
              <Text style={[styles.chipText, fields.bikeType === type.id && styles.chipTextSelected]}>{type.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FieldInput label="メーカー" value={fields.manufacturer} onChangeText={(v) => onChange({ manufacturer: v })} placeholder="例: TREK" />
      <FieldInput label="モデル" value={fields.model} onChangeText={(v) => onChange({ model: v })} placeholder="例: Domane" />
      <FieldInput label="メインカラー" value={fields.mainColor} onChangeText={(v) => onChange({ mainColor: v })} placeholder="例: マットブラック" />
      <FieldInput label="差し色" value={fields.accentColor} onChangeText={(v) => onChange({ accentColor: v })} placeholder="例: ホワイト" />
      <FieldInput label="ホイール" value={fields.wheelDepth} onChangeText={(v) => onChange({ wheelDepth: v })} placeholder="例: shallow / deep" />
      <FieldInput label="フレーム" value={fields.frameStyle} onChangeText={(v) => onChange({ frameStyle: v })} placeholder="例: aero / endurance" />
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  chipTextSelected: { color: colors.textInverse },
})
