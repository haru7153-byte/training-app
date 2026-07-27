import { postJSON } from '../apiClient'
import { BikeInfo } from '@/features/bike/types'
import { PersonalityInfo, SpeciesInfo, ThemeInfo } from '@/types/veria'

interface GenerateVeriaImageParams {
  bikeInfo: BikeInfo
  theme: ThemeInfo
  species: SpeciesInfo
  personality: PersonalityInfo
}

interface GenerateVeriaImageResult {
  imageUrl: string
  imagePrompt: string
}

/**
 * STEP3 Image Generation — a separate model/prompt/endpoint from generateVeriaProfile.
 * Per the spec it takes theme/species/personality produced by STEP2 as input, so
 * callers should run generateVeriaProfile first and pass its result in here.
 */
export function generateVeriaImage(params: GenerateVeriaImageParams): Promise<GenerateVeriaImageResult> {
  return postJSON<GenerateVeriaImageResult>('/api/rideverse/generate-veria-image', params)
}
