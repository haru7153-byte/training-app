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
      element: content.attributes.element,
      color_theme: content.attributes.colorTheme,
      personality: content.personality,
      introduction: content.introduction,
      image_url: content.imageUrl,
      bike_manufacturer: bikeInfo.manufacturer,
      bike_color: bikeInfo.color,
    })
    .select()
    .single()

  if (error) throw error
  return data
}
