import { postJSON } from '../apiClient'
import { BikeInfo } from '@/features/bike/types'
import { QuestionAnswers } from '@/features/questions/types'
import { GeneratedVeriaContent } from '@/types/veria'

export type VeriaProfile = Omit<GeneratedVeriaContent, 'imageUrl' | 'imagePrompt'>

/** STEP2 Personality — text/profile generation only. Independent of generateVeriaImage — see that module. */
export function generateVeriaProfile(bikeInfo: BikeInfo, answers: QuestionAnswers): Promise<VeriaProfile> {
  return postJSON<VeriaProfile>('/api/rideverse/generate-veria-profile', { bikeInfo, answers })
}
