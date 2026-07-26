import { Text, View } from 'react-native'
import { QuestionDefinition } from '../types'
import { ChoiceOption } from './ChoiceOption'
import { spacing, typography } from '@/theme'

interface QuestionStepProps {
  question: QuestionDefinition
  selectedOptionId: string | undefined
  onSelect: (optionId: string) => void
}

export function QuestionStep({ question, selectedOptionId, onSelect }: QuestionStepProps) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={typography.title}>{question.prompt}</Text>
      <View style={{ gap: spacing.sm }}>
        {question.options.map((option) => (
          <ChoiceOption
            key={option.id}
            label={option.label}
            selected={selectedOptionId === option.id}
            onPress={() => onSelect(option.id)}
          />
        ))}
      </View>
    </View>
  )
}
