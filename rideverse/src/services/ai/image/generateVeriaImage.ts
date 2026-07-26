import { postJSON } from '../apiClient'
import { BikeInfo } from '@/features/bike/types'
import { QuestionAnswers } from '@/features/questions/types'

/** Image generation only. Independent of generateVeriaProfile — see that module. */
export async function generateVeriaImage(bikeInfo: BikeInfo, answers: QuestionAnswers): Promise<string> {
  const result = await postJSON<{ imageUrl: string }>('/api/rideverse/generate-veria-image', { bikeInfo, answers })
  return result.imageUrl
}
