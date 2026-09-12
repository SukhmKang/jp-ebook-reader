const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'https://jp-ebook-reader-api.onrender.com'
).replace(/\/$/, '')

async function streamExplanation(body, onChunk) {
  const response = await fetch(`${API_BASE_URL}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) throw new Error(`API error ${response.status}`)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6))
        if (event.type === 'response.output_text.delta' && event.delta) {
          onChunk(event.delta)
        }
      } catch {
        continue
      }
    }
  }
}

export function explainInJapanese(paraText, pageContext, onChunk, userPrompt = '') {
  return streamExplanation({ paraText, pageContext, userPrompt }, onChunk)
}

export function explainImageInJapanese(imageData, onChunk, userPrompt = '') {
  return streamExplanation({ imageData, userPrompt }, onChunk)
}
