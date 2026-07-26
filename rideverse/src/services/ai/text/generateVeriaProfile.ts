import { postJSON } from '../apiClient'
import { BikeInfo } from '@/features/bike/types'
import { QuestionAnswers } from '@/features/questions/types'
import { GeneratedVeriaContent } from '@/types/veria'

type ProfileOnly = Omit<GeneratedVeriaContent, 'imageUrl'>

/** Text/profile generation only. Independent of generateVeriaImage — see that module. */
export function generateVeriaProfile(bikeInfo: BikeInfo, answers: QuestionAnswers): Promise<ProfileOnly> {
  return postJSON<ProfileOnly>('/api/rideverse/generate-veria-profile', { bikeInfo, answers })
}
