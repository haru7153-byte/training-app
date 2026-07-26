import { appConfig } from '@/config/appConfig'

export async function postJSON<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'AIリクエストに失敗しました')
  }
  return data as TResponse
}
