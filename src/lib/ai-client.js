// 兼容 AI 客户端（M4 + 追加）：OpenAI 兼容 + Anthropic 协议。
// 通过 baseUrl 是否含 /anthropic 自动判别；SSE 流式解析，统一 yield 文本增量。
import { loadSettings } from './storage.js'
import { customAIAllowed, defaultAIEnabled, supabase } from './supabase.js'

export class AIError extends Error {
  constructor(status, message, userMessage) {
    super(message)
    this.status = status
    // 面向用户的文案（可空）：流中 error 事件带服务端 message，调用方优先展示它
    this.userMessage = userMessage
  }
}

export const AI_NOT_CONFIGURED = 'AI_NOT_CONFIGURED'
export const AI_TIMEOUT_STATUS = 408 // 空闲超时的对外错误码（AIError.status），调用方据此给「重试」
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

// 流中 error 事件（评审 2026-09-06）：各 provider 在余额耗尽/内容审查断流时会以 SSE
// error 事件收尾，此前被当「无增量」忽略——半截文本走 onDone 被当完整回答，无重试入口
function sseErrorMessage(json) {
  if (json?.type === 'error') return json.error?.message || json.error?.type || 'AI 中途返回错误'
  if (json?.error) {
    if (typeof json.error === 'string') return json.error
    return json.error.message || 'AI 中途返回错误'
  }
  return null
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

async function* streamBody(body, onChunk) {
  if (!body) throw new AIError(0, '响应无内容')
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      onChunk?.() // 每收到数据重置空闲超时：服务器挂起不吐字时整体会被掐断
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
        const errText = sseErrorMessage(json)
        if (errText) throw new AIError(0, errText, errText)
        const delta = extractDelta(json)
        if (delta) yield delta
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }
}

export async function* streamChat({ messages, signal, tier = 'standard', forceCustom = false } = {}) {
  const settings = loadSettings()
  const { baseUrl, model, apiKey } = settings
  // 自定义入口被关闭（customAIAllowed=false）时，设置里残留的 aiMode:'custom'
  // 不再分流——统一走服务端默认 AI，防止用户被引导去填一个已被下线的表单。
  const useDefault =
    !forceCustom && defaultAIEnabled && (settings.aiMode === 'default' || !customAIAllowed)
  if (!useDefault && (!baseUrl || !model || !apiKey)) throw new Error(AI_NOT_CONFIGURED)

  const controller = new AbortController()
  // 超时语义 = 空闲超时：建连或流中途超过 TIMEOUT_MS 没有任何新数据即中止
  // （此前只保护建连，服务器保持连接不吐字时 generator 永久 pending）。
  // 超时 abort 必须与用户主动中止可区分：前者对外抛 AIError(408)（调用方给重试入口），
  // 后者保持 AbortError（调用方静默保留半截文本）——混同会让超时变成无提示死端。
  let timedOut = false
  const abortByTimeout = () => {
    timedOut = true
    controller.abort()
  }
  let timer = setTimeout(abortByTimeout, TIMEOUT_MS)
  const resetTimer = () => {
    clearTimeout(timer)
    timer = setTimeout(abortByTimeout, TIMEOUT_MS)
  }
  let onAbort = null
  if (signal) {
    if (signal.aborted) controller.abort()
    else {
      onAbort = () => controller.abort()
      signal.addEventListener('abort', onAbort)
    }
  }

  try {
    let req
    if (useDefault) {
      if (!supabase) throw new AIError(503, 'Supabase 未配置', '默认 AI 服务暂不可用。')
      const { data } = await supabase.auth.getSession()
      if (!data.session?.access_token) throw new AIError(401, '登录状态已失效', '请重新登录后使用 AI。')
      req = {
        url: '/api/ai/chat',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.session.access_token}`
          },
          body: JSON.stringify({ messages, mode: tier === 'deep' ? 'deep' : 'standard' }),
          signal: controller.signal
        }
      }
    } else {
      req = isAnthropic(baseUrl)
        ? buildAnthropicRequest({ baseUrl, model, apiKey, messages, signal: controller.signal })
        : buildOpenAIRequest({ baseUrl, model, apiKey, messages, signal: controller.signal })
    }

    const res = await fetch(req.url, req.init)
    if (!res.ok || !res.body) {
      const raw = await res.text().catch(() => '')
      let userMessage
      try {
        userMessage = JSON.parse(raw)?.error
        if (typeof userMessage === 'object') userMessage = userMessage.message
      } catch {
        userMessage = ''
      }
      throw new AIError(res.status, raw, userMessage || undefined)
    }
    for await (const delta of streamBody(res.body, resetTimer)) yield delta
  } catch (e) {
    if (timedOut && e?.name === 'AbortError') throw new AIError(AI_TIMEOUT_STATUS, '流式空闲超时')
    throw e
  } finally {
    clearTimeout(timer)
    if (signal && onAbort) signal.removeEventListener('abort', onAbort)
  }
}
