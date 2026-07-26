const OPENAI_BASE_URL = 'https://api.openai.com/v1'

async function request(path, body) {
  const response = await fetch(`${OPENAI_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI request to ${path} failed`)
  }
  return data
}

/** Chat completion that must return a single JSON object. */
export async function chatJSON({ model, messages }) {
  const data = await request('/chat/completions', {
    model,
    messages,
    response_format: { type: 'json_object' },
  })
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned no content')
  return JSON.parse(content)
}

/** Image generation. Returns a data URL (base64) so the client can upload it as-is. */
export async function generateImage({ model, prompt, size = '1024x1024' }) {
  const data = await request('/images/generations', { model, prompt, size, n: 1 })
  const image = data.data?.[0]
  if (!image) throw new Error('OpenAI returned no image')
  if (image.b64_json) return `data:image/png;base64,${image.b64_json}`
  if (image.url) return image.url
  throw new Error('OpenAI image response had neither b64_json nor url')
}
