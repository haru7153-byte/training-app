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
      theme: content.theme,
      species_name: content.species.name,
      personality: content.personality,
      appearance: content.appearance,
      voice: content.voice,
      metadata: content.metadata,
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
