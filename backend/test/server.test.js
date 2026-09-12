import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'

process.env.NODE_ENV = 'test'
const { createServer } = await import('../src/server.js')

let server
let baseUrl

before(async () => {
  server = createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(() => new Promise((resolve) => server.close(resolve)))

test('health endpoint responds', async () => {
  const response = await fetch(`${baseUrl}/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('preflight permits the local frontend', async () => {
  const response = await fetch(`${baseUrl}/api/explain`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:5173' },
  })
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
})

test('explain rejects unknown origins', async () => {
  const response = await fetch(`${baseUrl}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' },
    body: JSON.stringify({ paraText: 'テスト' }),
  })
  assert.equal(response.status, 403)
})

test('explain fails safely when the API key is absent', async () => {
  const response = await fetch(`${baseUrl}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify({ paraText: 'テスト' }),
  })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'AI service is not configured' })
})

test('image explanation sends a validated image to Terra', async () => {
  const nativeFetch = globalThis.fetch
  let upstreamBody
  process.env.OPENAI_API_KEY = 'test-key'
  globalThis.fetch = async (url, options) => {
    if (String(url) === 'https://api.openai.com/v1/responses') {
      upstreamBody = JSON.parse(options.body)
      return new Response('data: {"type":"response.output_text.delta","delta":"ok"}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    }
    return nativeFetch(url, options)
  }

  try {
    const response = await nativeFetch(`${baseUrl}/api/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        imageData: 'data:image/jpeg;base64,YWJj',
        storyContext: '[Page 4]\nアドルフは駅へ向かった。',
      }),
    })
    assert.equal(response.status, 200)
    assert.equal(upstreamBody.model, 'gpt-5.6-terra')
    assert.equal(upstreamBody.input[0].content[1].type, 'input_image')
    assert.equal(upstreamBody.input[0].content[1].image_url, 'data:image/jpeg;base64,YWJj')
    assert.match(upstreamBody.input[0].content[0].text, /アドルフは駅へ向かった/)
    assert.match(upstreamBody.input[0].content[0].text, /OCRの誤り/)
    assert.match(upstreamBody.input[0].content[0].text, /単語（よみ）/)
    assert.match(upstreamBody.input[0].content[0].text, /選択範囲にはない語は挙げない/)
    assert.match(upstreamBody.instructions, /英語は使わない/)
  } finally {
    globalThis.fetch = nativeFetch
    delete process.env.OPENAI_API_KEY
  }
})
