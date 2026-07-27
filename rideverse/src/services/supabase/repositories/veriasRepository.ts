import { supabase } from '../client'
import { BikeInfo } from '@/features/bike/types'
import { GeneratedVeriaContent } from '@/types/veria'

interface CreateVeriaInput {
  id: string
  userId: string
  name: string
  content: GeneratedVeriaContent
  bikeInfo: BikeInfo
}

export async function createVeria({ id, userId, name, content, bikeInfo }: CreateVeriaInput) {
  const { data, error } = await supabase
    .from('velias')
    .insert({
      id,
      user_id: userId,
      name,
      species: content.species,
      appearance: content.appearance,
      personality: content.personality,
      keywords: content.keywords,
      voice_tone: content.voiceTone,
      greeting: content.greeting,
      favorite_ride: content.favoriteRide,
      favorite_season: content.favoriteSeason,
      image_url: content.imageUrl,
      image_prompt: content.imagePrompt,
      bike_type: bikeInfo.bikeType,
      bike_manufacturer: bikeInfo.manufacturer,
      bike_model: bikeInfo.model,
      bike_main_color: bikeInfo.mainColor,
      bike_accent_color: bikeInfo.accentColor,
    })
    .select()
    .single()

  if (error) throw error
  return data
}
