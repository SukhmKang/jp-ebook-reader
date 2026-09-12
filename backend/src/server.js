import http from 'node:http'
import { Readable } from 'node:stream'

const PORT = Number(process.env.PORT || 8787)
const MAX_BODY_BYTES = 3 * 1024 * 1024
const MAX_IMAGE_DATA_LENGTH = 2.5 * 1024 * 1024
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR || 30)
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra'
const requestsByIp = new Map()

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://jp-ebook-reader.pages.dev',
]

function configuredOrigins() {
  const value = process.env.ALLOWED_ORIGINS
  return value ? value.split(',').map((origin) => origin.trim()).filter(Boolean) : defaultOrigins
}

function isAllowedOrigin(origin) {
  if (!origin) return false
  if (configuredOrigins().includes(origin)) return true
  return /^https:\/\/[a-z0-9-]+\.jp-ebook-reader\.pages\.dev$/.test(origin)
}

function writeJson(res, status, body, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  }
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers.Vary = 'Origin'
  }
  res.writeHead(status, headers)
  res.end(JSON.stringify(body))
}

async function readJson(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('request_too_large')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('invalid_json')
  }
}

function isRateLimited(req) {
  const forwarded = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
  const ip = forwarded || req.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const windowStart = now - 60 * 60 * 1000
  const recent = (requestsByIp.get(ip) || []).filter((time) => time > windowStart)
  if (recent.length >= RATE_LIMIT) {
    requestsByIp.set(ip, recent)
    return true
  }
  recent.push(now)
  requestsByIp.set(ip, recent)
  return false
}

function storyBlock(storyContext) {
  return storyContext
    ? `\n\nここまでの物語（OCRの誤りを含む可能性があるため、文脈の参考としてのみ使用）：\n${storyContext}`
    : ''
}

function buildUserMessage({ paraText, pageContext, userPrompt, storyContext }) {
  const contextBlock = pageContext
    ? `\n\nページの他のテキスト（文脈として）：\n${pageContext}`
    : ''
  const focusBlock = userPrompt?.trim()
    ? `\n\nユーザーからの質問：${userPrompt.trim()}\nこの質問に答えながら説明してください。`
    : ''
  return `以下の文をわかりやすく説明してください：\n\n「${paraText}」${contextBlock}${storyBlock(storyContext)}${focusBlock}`
}

function validImageData(imageData) {
  return typeof imageData === 'string' &&
    imageData.length <= MAX_IMAGE_DATA_LENGTH &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageData)
}

function buildInput({ paraText, pageContext, userPrompt, imageData, storyContext }) {
  if (!imageData) return buildUserMessage({ paraText, pageContext, userPrompt, storyContext })
  const question = userPrompt?.trim()
    ? `\n\nユーザーからの質問：${userPrompt.trim()}`
    : ''
  return [{
    role: 'user',
    content: [
      {
        type: 'input_text',
        text: `選択された漫画の画像を読み取り、日本語学習者にわかりやすく説明してください。台詞やナレーションの意味とニュアンスを中心にし、ここまでの展開を踏まえて人物や場面を説明してください。読めない箇所やOCRと矛盾する箇所は推測で断定しないでください。

説明の後に、選択範囲に実際に書かれている語のうち、日本語学習者に難しそうなものだけを「語彙」という見出しで挙げてください。形式は「- 単語（よみ）— やさしい日本語での意味」とします。英語は一切使わないでください。難しい語がない場合は語彙欄を省略してください。物語の文脈だけに登場し、選択範囲にはない語は挙げないでください。${storyBlock(storyContext)}${question}`,
      },
      { type: 'input_image', image_url: imageData, detail: 'high' },
    ],
  }]
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin

    if (req.method === 'GET' && req.url === '/health') {
      writeJson(res, 200, { status: 'ok' }, origin)
      return
    }

    if (req.method === 'OPTIONS' && req.url === '/api/explain') {
      if (!isAllowedOrigin(origin)) {
        writeJson(res, 403, { error: 'Origin not allowed' }, origin)
        return
      }
      res.writeHead(204, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      })
      res.end()
      return
    }

    if (req.method !== 'POST' || req.url !== '/api/explain') {
      writeJson(res, 404, { error: 'Not found' }, origin)
      return
    }

    if (!isAllowedOrigin(origin)) {
      writeJson(res, 403, { error: 'Origin not allowed' }, origin)
      return
    }
    if (isRateLimited(req)) {
      writeJson(res, 429, { error: 'Too many requests' }, origin)
      return
    }
    if (!process.env.OPENAI_API_KEY) {
      writeJson(res, 503, { error: 'AI service is not configured' }, origin)
      return
    }

    let body
    try {
      body = await readJson(req)
    } catch (error) {
      const status = error.message === 'request_too_large' ? 413 : 400
      writeJson(res, status, { error: 'Invalid request body' }, origin)
      return
    }

    const paraText = typeof body.paraText === 'string' ? body.paraText.trim() : ''
    const pageContext = typeof body.pageContext === 'string' ? body.pageContext.slice(0, 20000) : ''
    const userPrompt = typeof body.userPrompt === 'string' ? body.userPrompt.slice(0, 2000) : ''
    const storyContext = typeof body.storyContext === 'string' ? body.storyContext.slice(0, 16000) : ''
    const imageData = typeof body.imageData === 'string' ? body.imageData : ''
    if ((!paraText && !imageData) || paraText.length > 8000 || (imageData && !validImageData(imageData))) {
      writeJson(res, 400, { error: 'Invalid explanation input' }, origin)
      return
    }

    let upstream
    try {
      upstream = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          max_output_tokens: 512,
          stream: true,
          reasoning: { effort: 'low' },
          instructions: `あなたは日本語学習者をサポートする先生です。
与えられた文や表現を、もっとわかりやすい日本語で説明してください。
・やさしい言葉を使う
・難しい語彙は簡単に解説する
・説明本文は3〜5文の自然な文章にする
・画像入力の語彙欄を除き、箇条書きや見出しは使わない
・英語は使わない
・教訓や道徳的なまとめは、原文に明示されていない限り加えない
・返答はすべて日本語で`,
          input: buildInput({ paraText, pageContext, userPrompt, imageData, storyContext }),
        }),
      })
    } catch {
      writeJson(res, 502, { error: 'AI service unavailable' }, origin)
      return
    }

    if (!upstream.ok || !upstream.body) {
      writeJson(res, 502, { error: 'AI request failed' }, origin)
      return
    }

    res.writeHead(200, {
      'Access-Control-Allow-Origin': origin,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      Vary: 'Origin',
    })
    Readable.fromWeb(upstream.body).pipe(res)
  })
}

if (process.env.NODE_ENV !== 'test') {
  createServer().listen(PORT, '0.0.0.0', () => {
    console.log(`API listening on port ${PORT}`)
  })
}
