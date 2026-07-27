export type BikeType = 'road' | 'mtb' | 'gravel' | 'mini_velo' | 'mamachari' | 'unknown'

export const BIKE_TYPES: { id: BikeType; label: string }[] = [
  { id: 'road', label: 'ロード' },
  { id: 'mtb', label: 'MTB' },
  { id: 'gravel', label: 'グラベル' },
  { id: 'mini_velo', label: 'ミニベロ' },
  { id: 'mamachari', label: 'ママチャリ' },
]

/** Vision analysis result. Any field the model can't read from the photo comes back as "unknown" — never a guess. */
export interface BikeAnalysisResult {
  bikeType: BikeType
  manufacturer: string
  model: string
  mainColor: string
  accentColor: string
  wheelDepth: string
  frameStyle: string
}

/** The rider-confirmed bike info actually used for generation — every field manually editable. */
export interface BikeInfo {
  photoUri: string
  bikeType: BikeType
  manufacturer: string
  model: string
  mainColor: string
  accentColor: string
  wheelDepth: string
  frameStyle: string
}
