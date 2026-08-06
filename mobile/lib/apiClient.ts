import { supabase } from './supabase'

/** AI系エンドポイント用のfetch。ログイン中ユーザーのアクセストークンを付けて送る。 */
export async function authedPost(url: string, body: unknown): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}
