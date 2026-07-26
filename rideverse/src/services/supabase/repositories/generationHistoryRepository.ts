import { supabase } from '../client'
import { BikeInfo } from '@/features/bike/types'
import { QuestionAnswers } from '@/features/questions/types'
import { GeneratedVeriaContent } from '@/types/veria'

interface LogGenerationInput {
  userId: string
  veriaId: string
  bikeInfo: BikeInfo
  answers: QuestionAnswers
  content: GeneratedVeriaContent
  chosenName: string
}

/** Keeps the raw generation inputs/outputs so future re-rolls or debugging have a trail. */
export async function logGeneration({ userId, veriaId, bikeInfo, answers, content, chosenName }: LogGenerationInput) {
  const { error } = await supabase.from('generation_history').insert({
    user_id: userId,
    veria_id: veriaId,
    bike_info: bikeInfo,
    answers,
    name_candidates: content.nameCandidates,
    chosen_name: chosenName,
    raw_ai_profile: content,
  })
  if (error) throw error
}
