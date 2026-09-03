// AI 客户端（M4 Task 2）：mock fetch 构造 SSE 字节流。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { streamChat, AIError, AI_NOT_CONFIGURED } from '../src/lib/ai-client.js'
import { saveSettings } from '../src/lib/storage.js'

function sseResponse(chunks) {
  // chunks: array of strings already SSE-formatted; deliver as a byte stream
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(encoder.encode(ch))
      c.close()
    }
  })
  return { ok: true, status: 200, body, text: async () => '' }
}

function setupAI() {
  saveSettings({ baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', apiKey: 'sk-test' })
}

describe('ai-client', () => {
  beforeEach(() => {
    localStorage.clear()
    setupAI()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('未配置时抛 AI_NOT_CONFIGURED', async () => {
    localStorage.clear()
    const gen = streamChat({ messages: [] })
    await expect(gen.next()).rejects.toThrow(AI_NOT_CONFIGURED)
  })

  it('增量输出 SSE delta，遇 [DONE] 终止', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse(['data: {"choices":[{"delta":{"content":"你"}}]}\n\n', 'data: {"choices":[{"delta":{"content":"好"}}]}\n\n', 'data: [DONE]\n\n'])))
    const out = []
    for await (const d of streamChat({ messages: [{ role: 'user', content: 'hi' }] })) out.push(d)
    expect(out.join('')).toBe('你好')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('非 2xx 抛 AIError 带状态码', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, body: null, text: async () => 'unauthorized' })))
    const gen = streamChat({ messages: [] })
    await expect(gen.next()).rejects.toMatchObject({ status: 401 })
    // AIError 实例
    await expect(streamChat({ messages: [] }).next()).rejects.toBeInstanceOf(AIError)
  })

  it('处理 baseUrl 尾斜杠', async () => {
    saveSettings({ baseUrl: 'https://x.com/', model: 'm', apiKey: 'k' })
    const fetchMock = vi.fn(async () => sseResponse(['data: [DONE]\n\n']))
    vi.stubGlobal('fetch', fetchMock)
    for await (const _ of streamChat({ messages: [] })) { /* noop */ }
    const url = fetchMock.mock.calls[0][0]
    expect(url).toBe('https://x.com/chat/completions')
  })

  it('Anthropic 协议：URL 指向 /v1/messages 且解析 content_block_delta', async () => {
    saveSettings({ baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic', model: 'mimo-v2.5', apiKey: 'sk-x' })
    const chunks = [
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"你好"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"，星语"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n'
    ]
    const fetchMock = vi.fn(async () => sseResponse(chunks))
    vi.stubGlobal('fetch', fetchMock)
    const out = []
    for await (const d of streamChat({ messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }] })) out.push(d)
    expect(out.join('')).toBe('你好，星语')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://token-plan-cn.xiaomimimo.com/anthropic/v1/messages')
    expect(init.headers['x-api-key']).toBe('sk-x')
    expect(init.headers['anthropic-version']).toBe('2023-06-01')
  })

  // ---- 空闲超时分类（评审 2026-09-03：超时 abort 与用户主动中止必须可区分）----

  // 服从 signal 的「挂起」流：收到第一个 chunk 后不再吐字，abort 时让 read() 以 AbortError 拒绝
  // （真实 fetch 的行为；mock 流必须自己接 signal，否则 abort 对它无效、测试会挂死）
  function hangingStreamAfter(chunks) {
    return (url, init) => {
      const encoder = new TextEncoder()
      const body = new ReadableStream({
        start(c) {
          for (const ch of chunks) c.enqueue(encoder.encode(ch))
          const onAbort = () => c.error(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          if (init.signal.aborted) onAbort()
          else init.signal.addEventListener('abort', onAbort, { once: true })
        }
      })
      return Promise.resolve({ ok: true, status: 200, body, text: async () => '' })
    }
  }

  it('空闲超时（已收到半截文本后挂起）抛 AIError 408，而非 AbortError', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(hangingStreamAfter(['data: {"choices":[{"delta":{"content":"你"}}]}\n\n'])))
    const gen = streamChat({ messages: [{ role: 'user', content: 'hi' }] })
    const first = await gen.next() // 先拿到第一个增量
    expect(first.value).toBe('你')
    const pending = gen.next() // 流挂起，推进假时钟触发 30s 空闲超时
    pending.catch(() => {}) // 先挂 handler 防 unhandledRejection 竞态：advanceTimersByTimeAsync
    // 刷微任务时 rejection 若在 expect 接手前落地，CI（Node22/Linux）会记为 unhandled error
    await vi.advanceTimersByTimeAsync(31000)
    await expect(pending).rejects.toMatchObject({ status: 408, message: '流式空闲超时' })
    vi.useRealTimers()
  })

  it('建连阶段挂起超时同样抛 AIError 408', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (url, init) =>
          new Promise((_, reject) => {
            const onAbort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
            if (init.signal.aborted) onAbort()
            else init.signal.addEventListener('abort', onAbort, { once: true })
          })
      )
    )
    const gen = streamChat({ messages: [{ role: 'user', content: 'hi' }] })
    const pending = gen.next() // fetch 挂起，推进假时钟触发建连超时
    pending.catch(() => {}) // 同上：防 unhandledRejection 竞态
    await vi.advanceTimersByTimeAsync(31000)
    await expect(pending).rejects.toMatchObject({ status: 408 })
    vi.useRealTimers()
  })

  it('用户主动中止仍保持 AbortError（调用方按「保留半截文本」处理）', async () => {
    vi.useFakeTimers()
    const external = new AbortController()
    vi.stubGlobal('fetch', vi.fn(hangingStreamAfter(['data: {"choices":[{"delta":{"content":"你"}}]}\n\n'])))
    const gen = streamChat({ messages: [{ role: 'user', content: 'hi' }], signal: external.signal })
    await gen.next()
    const pending = gen.next()
    pending.catch(() => {}) // 同上：防 unhandledRejection 竞态
    external.abort() // 假时钟下 abort 监听同步触发，无需推进时间
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    vi.useRealTimers()
  })
})
