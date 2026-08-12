// 兼容 AI 客户端（M4 + 追加）：OpenAI 兼容 + Anthropic 协议。
// 通过 baseUrl 是否含 /anthropic 自动判别；SSE 流式解析，统一 yield 文本增量。
import { loadSettings } from './storage.js'

export class AIError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const AI_NOT_CONFIGURED = 'AI_NOT_CONFIGURED'
const TIMEOUT_MS = 30000

function isAnthropic(baseUrl) {
  return /\/anthropic/i.test(baseUrl)
}

function buildAnthropicRequest({ baseUrl, model, apiKey, messages, signal }) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
  const conv = messages.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content)
  }))
  return {
    url: `${baseUrl.replace(/\/+$/, '')}/v1/messages`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model, max_tokens: 2048, stream: true, system, messages: conv }),
      signal
    }
  }
}

function buildOpenAIRequest({ baseUrl, model, apiKey, messages, signal }) {
  return {
    url: `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, stream: true }),
      signal
    }
  }
}

// 从一条 SSE data: JSON 提取增量文本；无增量返回 ''
function extractDelta(json) {
  if (!json || typeof json !== 'object') return ''
  // OpenAI: choices[0].delta.content
  const oc = json.choices?.[0]?.delta?.content
  if (typeof oc === 'string') return oc
  // Anthropic: type=content_block_delta, delta.type=text_delta, delta.text
  if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
    return json.delta.text || ''
  }
  return ''
}

function isDone(json) {
  if (json === '[DONE]') return true
  // Anthropic: message_stop / message_delta
  if (json?.type === 'message_stop') return true
  if (json?.type === 'message_delta') return true
  return false
}

async function* streamBody(body, signal) {
  if (!body) throw new AIError(0, '响应无内容')
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 1)
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') return
        let json
        try {
          json = JSON.parse(payload)
        } catch {
          continue
        }
        if (isDone(json)) return
        const delta = extractDelta(json)
        if (delta) yield delta
      }
    }
  } finally {
    if (signal && signal._onAbort) {
      signal.removeEventListener('abort', signal._onAbort)
      delete signal._onAbort
    }
  }
}

export async function* streamChat({ messages, signal } = {}) {
  const { baseUrl, model, apiKey } = loadSettings()
  if (!baseUrl || !model || !apiKey) throw new Error(AI_NOT_CONFIGURED)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  if (signal) {
    if (signal.aborted) controller.abort()
    else {
      const onAbort = () => controller.abort()
      signal._onAbort = onAbort
      signal.addEventListener('abort', onAbort)
    }
  }

  const req = isAnthropic(baseUrl)
    ? buildAnthropicRequest({ baseUrl, model, apiKey, messages, signal: controller.signal })
    : buildOpenAIRequest({ baseUrl, model, apiKey, messages, signal: controller.signal })

  let res
  try {
    res = await fetch(req.url, req.init)
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok || !res.body) {
    throw new AIError(res.status, await res.text().catch(() => ''))
  }
  for await (const delta of streamBody(res.body, signal)) yield delta
}
