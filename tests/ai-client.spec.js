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
})
