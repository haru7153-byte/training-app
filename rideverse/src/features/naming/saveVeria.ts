import * as Crypto from 'expo-crypto'
import { BikeInfo } from '@/features/bike/types'
import { QuestionAnswers } from '@/features/questions/types'
import { ensureUser } from '@/services/supabase/client'
import { logGeneration } from '@/services/supabase/repositories/generationHistoryRepository'
import { ensureUserProfile } from '@/services/supabase/repositories/usersRepository'
import { createVeria } from '@/services/supabase/repositories/veriasRepository'
import { uploadVeriaImage } from '@/services/supabase/storage'
import { GeneratedVeriaContent, Veria } from '@/types/veria'

interface SaveVeriaParams {
  bikeInfo: BikeInfo
  answers: QuestionAnswers
  content: GeneratedVeriaContent
  chosenName: string
}

/** Persists the named veria: uploads its image to permanent storage, then writes velias + generation_history. */
export async function saveVeria({ bikeInfo, answers, content, chosenName }: SaveVeriaParams): Promise<Veria> {
  const user = await ensureUser()
  await ensureUserProfile(user.id)

  const veriaId = Crypto.randomUUID()
  const permanentImageUrl = await uploadVeriaImage(user.id, veriaId, content.imageUrl)
  const finalContent: GeneratedVeriaContent = { ...content, imageUrl: permanentImageUrl }

  const row = await createVeria({ id: veriaId, userId: user.id, name: chosenName, content: finalContent, bikeInfo })
  await logGeneration({ userId: user.id, veriaId, bikeInfo, answers, content: finalContent, chosenName })

  return {
    id: row.id,
    name: row.name,
    species: row.species,
    attributes: { element: row.element, colorTheme: row.color_theme },
    personality: row.personality,
    introduction: row.introduction,
    imageUrl: row.image_url,
    nameCandidates: content.nameCandidates,
    birthday: row.birthday,
    ownerId: row.user_id,
    createdAt: row.created_at,
  }
}
