const API_KEY = import.meta.env.VITE_ANTHROPIC_API_TOKEN

export async function explainInJapanese(paraText, pageContext, onChunk, userPrompt = '') {
  const contextBlock = pageContext
    ? `\n\nページの他のテキスト（文脈として）：\n${pageContext}`
    : ''
  const focusBlock = userPrompt.trim()
    ? `\n\n特に注目してほしい点：${userPrompt.trim()}`
    : ''

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      stream: true,
      system: `あなたは日本語学習者をサポートする先生です。
与えられた文や表現を、もっとわかりやすい日本語で説明してください。
・やさしい言葉を使う
・難しい語彙は簡単に解説する
・簡潔にまとめる
・返答はすべて日本語で`,
      messages: [{
        role: 'user',
        content: `以下の文をわかりやすく説明してください：\n\n「${paraText}」${contextBlock}${focusBlock}`,
      }],
    }),
  })

  if (!response.ok) throw new Error(`API error ${response.status}`)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const event = JSON.parse(data)
        if (event.type === 'content_block_delta' && event.delta?.text) {
          onChunk(event.delta.text)
        }
      } catch {}
    }
  }
}
