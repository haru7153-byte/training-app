import { supabase } from './client'

const BIKE_PHOTOS_BUCKET = 'bike-photos'
const VERIA_IMAGES_BUCKET = 'veria-images'

async function uploadToBucket(bucket: string, path: string, sourceUri: string): Promise<string> {
  const response = await fetch(sourceUri)
  const blob = await response.blob()
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export function uploadBikePhoto(userId: string, localUri: string): Promise<string> {
  return uploadToBucket(BIKE_PHOTOS_BUCKET, `${userId}/${Date.now()}.jpg`, localUri)
}

/** sourceUrl may be a remote OpenAI URL or a base64 data: URL — both fetch() fine in Expo. */
export function uploadVeriaImage(userId: string, veriaId: string, sourceUrl: string): Promise<string> {
  return uploadToBucket(VERIA_IMAGES_BUCKET, `${userId}/${veriaId}.png`, sourceUrl)
}
