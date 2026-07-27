import { postJSON } from '../apiClient'
import { BikeAnalysisResult } from '@/features/bike/types'

/** STEP1 Vision — OpenAI analysis of a bike photo, isolated from text/image generation. */
export function analyzeBikePhoto(imageBase64: string): Promise<BikeAnalysisResult> {
  return postJSON<BikeAnalysisResult>('/api/rideverse/analyze-bike', { imageBase64 })
}
