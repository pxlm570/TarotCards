// OpenAI 兼容流式 AI 客户端（M4 Task 2）：原生 fetch + SSE 解析，不引 SDK。
import { loadSettings } from './storage.js'

export class AIError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const AI_NOT_CONFIGURED = 'AI_NOT_CONFIGURED'
const TIMEOUT_MS = 30000

export async function* streamChat({ messages, signal } = {}) {
  const { baseUrl, model, apiKey } = loadSettings()
  if (!baseUrl || !model || !apiKey) throw new Error(AI_NOT_CONFIGURED)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort)
  }

  let res
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: controller.signal
    })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok || !res.body) {
    throw new AIError(res.status, await res.text().catch(() => ''))
  }

  const reader = res.body.getReader()
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
        try {
          const json = JSON.parse(payload)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) yield delta
        } catch {
          /* 不完整行：忽略 */
        }
      }
    }
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}
