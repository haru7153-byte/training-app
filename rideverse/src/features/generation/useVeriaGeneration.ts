import { useCallback, useEffect, useState } from 'react'
import { BikeInfo } from '@/features/bike/types'
import { QuestionAnswers } from '@/features/questions/types'
import { generateVeriaImage } from '@/services/ai/image/generateVeriaImage'
import { generateVeriaProfile } from '@/services/ai/text/generateVeriaProfile'
import { GeneratedVeriaContent } from '@/types/veria'

type Status = 'loading' | 'success' | 'error'

interface UseVeriaGenerationResult {
  status: Status
  content: GeneratedVeriaContent | null
  error: string | null
  retry: () => void
}

/**
 * Orchestrates the two independent AI services: STEP2 (text profile) and STEP3
 * (image). They are separate models/prompts/endpoints, but per the v1.0 spec
 * STEP3 takes STEP2's species/personality/keywords as input, so this hook runs
 * them in sequence rather than in parallel.
 */
export function useVeriaGeneration(bikeInfo: BikeInfo | null, answers: QuestionAnswers): UseVeriaGenerationResult {
  const [status, setStatus] = useState<Status>('loading')
  const [content, setContent] = useState<GeneratedVeriaContent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const run = useCallback(async () => {
    if (!bikeInfo) return
    setStatus('loading')
    setError(null)
    try {
      const profile = await generateVeriaProfile(bikeInfo, answers)
      const { imageUrl, imagePrompt } = await generateVeriaImage({
        bikeInfo,
        species: profile.species,
        personality: profile.personality,
        keywords: profile.keywords,
      })
      setContent({ ...profile, imageUrl, imagePrompt })
      setStatus('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ヴェリアの生成に失敗しました')
      setStatus('error')
    }
  }, [bikeInfo, answers])

  useEffect(() => {
    run()
  }, [run, attempt])

  return { status, content, error, retry: () => setAttempt((n) => n + 1) }
}
