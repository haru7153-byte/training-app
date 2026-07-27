import { postJSON } from '../apiClient'
import { BikeInfo } from '@/features/bike/types'

interface GenerateVeriaImageParams {
  bikeInfo: BikeInfo
  species: string
  personality: string
  keywords: string[]
}

interface GenerateVeriaImageResult {
  imageUrl: string
  imagePrompt: string
}

/**
 * STEP3 Image Generation — a separate model/prompt/endpoint from generateVeriaProfile.
 * Per the v1.0 spec it takes species/personality/keywords produced by STEP2 as input,
 * so callers should run generateVeriaProfile first and pass its result in here.
 */
export function generateVeriaImage(params: GenerateVeriaImageParams): Promise<GenerateVeriaImageResult> {
  return postJSON<GenerateVeriaImageResult>('/api/rideverse/generate-veria-image', params)
}
