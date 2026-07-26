import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '@/app/RootNavigator'
import { Button } from '@/components/Button'
import { ScreenContainer } from '@/components/ScreenContainer'
import { colors, spacing } from '@/theme'
import { useGenerationSession } from '@/context/GenerationSessionContext'
import { QUESTIONS } from './config/questions.config'
import { QuestionAnswers } from './types'
import { QuestionStep } from './components/QuestionStep'

type Props = NativeStackScreenProps<RootStackParamList, 'Questions'>

export function QuestionsScreen({ navigation }: Props) {
  const { answers, setAnswers } = useGenerationSession()
  const [stepIndex, setStepIndex] = useState(0)
  const [localAnswers, setLocalAnswers] = useState<QuestionAnswers>(answers)

  const question = QUESTIONS[stepIndex]
  const isLastStep = stepIndex === QUESTIONS.length - 1
  const selectedOptionId = localAnswers[question.id]

  function selectOption(optionId: string) {
    setLocalAnswers((prev) => ({ ...prev, [question.id]: optionId }))
  }

  function goNext() {
    if (isLastStep) {
      setAnswers(localAnswers)
      navigation.navigate('Generation')
      return
    }
    setStepIndex((i) => i + 1)
  }

  return (
    <ScreenContainer style={{ justifyContent: 'space-between' }}>
      <View style={{ gap: spacing.lg }}>
        <View style={styles.progressRow}>
          {QUESTIONS.map((q, i) => (
            <View key={q.id} style={[styles.progressDot, i <= stepIndex && styles.progressDotActive]} />
          ))}
        </View>
        <QuestionStep question={question} selectedOptionId={selectedOptionId} onSelect={selectOption} />
      </View>
      <View style={{ gap: spacing.sm }}>
        {stepIndex > 0 && <Text style={{ textAlign: 'center' }} onPress={() => setStepIndex((i) => i - 1)}>
          戻る
        </Text>}
        <Button label={isLastStep ? 'ヴェリアを生成する' : '次へ'} onPress={goNext} disabled={!selectedOptionId} />
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: 'row', gap: spacing.xs },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressDotActive: { backgroundColor: colors.accent },
})
