import { createContext, ReactNode, useContext, useMemo, useState } from 'react'
import { BikeInfo } from '@/features/bike/types'
import { QuestionAnswers } from '@/features/questions/types'
import { GeneratedVeriaContent, Veria } from '@/types/veria'

interface GenerationSessionValue {
  bikeInfo: BikeInfo | null
  setBikeInfo: (bikeInfo: BikeInfo) => void
  answers: QuestionAnswers
  setAnswers: (answers: QuestionAnswers) => void
  generatedContent: GeneratedVeriaContent | null
  setGeneratedContent: (content: GeneratedVeriaContent) => void
  veria: Veria | null
  setVeria: (veria: Veria) => void
  reset: () => void
}

const GenerationSessionContext = createContext<GenerationSessionValue | null>(null)

/** Wizard-scoped state shared by Bike -> Questions -> Generation -> Naming -> Profile. */
export function GenerationSessionProvider({ children }: { children: ReactNode }) {
  const [bikeInfo, setBikeInfo] = useState<BikeInfo | null>(null)
  const [answers, setAnswers] = useState<QuestionAnswers>({})
  const [generatedContent, setGeneratedContent] = useState<GeneratedVeriaContent | null>(null)
  const [veria, setVeria] = useState<Veria | null>(null)

  const value = useMemo<GenerationSessionValue>(
    () => ({
      bikeInfo,
      setBikeInfo,
      answers,
      setAnswers,
      generatedContent,
      setGeneratedContent,
      veria,
      setVeria,
      reset: () => {
        setBikeInfo(null)
        setAnswers({})
        setGeneratedContent(null)
        setVeria(null)
      },
    }),
    [bikeInfo, answers, generatedContent, veria]
  )

  return <GenerationSessionContext.Provider value={value}>{children}</GenerationSessionContext.Provider>
}

export function useGenerationSession(): GenerationSessionValue {
  const ctx = useContext(GenerationSessionContext)
  if (!ctx) throw new Error('useGenerationSession must be used within GenerationSessionProvider')
  return ctx
}
