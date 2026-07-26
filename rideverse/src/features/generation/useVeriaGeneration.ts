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
 * Orchestrates the two independent AI calls (text profile + image) from the same
 * raw inputs. They run in parallel and neither depends on the other's output.
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
      const [profile, imageUrl] = await Promise.all([
        generateVeriaProfile(bikeInfo, answers),
        generateVeriaImage(bikeInfo, answers),
      ])
      setContent({ ...profile, imageUrl })
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
