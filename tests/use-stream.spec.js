// useStream 单测：流式生命周期统一收口（挂载即流/卸载即中止/错误分类/重试）。
// ai-client 整模块 mock 掉，用可编程的假 streamChat 驱动各分支。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

const { streamChatMock } = vi.hoisted(() => ({
  // 每个用例给 behavior 赋值：async function* ({ signal }) { ... }
  streamChatMock: { behavior: null }
}))

vi.mock('../src/lib/ai-client.js', () => ({
  streamChat: (opts) => streamChatMock.behavior(opts),
  AI_NOT_CONFIGURED: 'AI_NOT_CONFIGURED',
  AI_TIMEOUT_STATUS: 408, // use-stream.js 会导入它，mock 必须一并提供（缺失时取值即抛错）
  AIError: class AIError extends Error {
    constructor(status, message) {
      super(message)
      this.status = status
    }
  }
}))

const { useStream } = await import('../src/composables/use-stream.js')
const { AIError } = await import('../src/lib/ai-client.js')

// 挂一个宿主组件，把 useStream 返回值捞出来
function mountHost(props = {}) {
  let exposed
  const Host = defineComponent({
    setup() {
      exposed = useStream(() => [{ role: 'user', content: 'hi' }], { immediate: true, ...props })
      return () => h('div')
    }
  })
  const wrapper = mount(Host)
  return { wrapper, stream: exposed }
}

async function flush(times = 6) {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

function okStream(chunks) {
  return async function* ({ signal }) {
    if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    for (const c of chunks) {
      if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
      yield c
    }
  }
}

describe('useStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    streamChatMock.behavior = null
  })

  it('immediate 挂载即流：delta 拼进 text，onDone 收到全文', async () => {
    streamChatMock.behavior = okStream(['你', '好'])
    const onDone = vi.fn()
    const { stream } = mountHost({ onDone })
    await flush()
    expect(stream.text.value).toBe('你好')
    expect(stream.error.value).toBe('')
    expect(stream.streaming.value).toBe(false)
    expect(onDone).toHaveBeenCalledWith('你好')
  })

  it('空闲超时（AIError 408）落入专属错误文案，可重试', async () => {
    streamChatMock.behavior = async function* () {
      yield '你'
      throw new AIError(408, '流式空闲超时')
    }
    const { stream } = mountHost()
    await flush()
    expect(stream.text.value).toBe('你')
    expect(stream.error.value).toContain('长时间没有响应')
    // 重试：换一条成功流，错误清空、文本重开
    streamChatMock.behavior = okStream(['好'])
    stream.start()
    await flush()
    expect(stream.error.value).toBe('')
    expect(stream.text.value).toBe('好')
  })

  it('未配置时给引导文案；其他 AIError 按状态码分类', async () => {
    streamChatMock.behavior = async function* () {
      throw new Error('AI_NOT_CONFIGURED')
    }
    const { stream } = mountHost()
    await flush()
    expect(stream.error.value).toContain('尚未配置 AI')

    streamChatMock.behavior = async function* () {
      throw new AIError(429, 'rate')
    }
    stream.start()
    await flush()
    expect(stream.error.value).toContain('请求过于频繁')
  })

  it('卸载即中止：signal 被 abort、保留半截文本、不算错误', async () => {
    const signals = []
    streamChatMock.behavior = ({ signal }) =>
      (async function* () {
        signals.push(signal)
        yield '你'
        await new Promise((_, reject) => {
          if (signal.aborted) reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          else signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true })
        })
      })()
    const { wrapper, stream } = mountHost()
    await flush(4)
    expect(stream.text.value).toBe('你')
    wrapper.unmount()
    expect(signals[0].aborted).toBe(true)
  })

  it('streaming 中重复 start 被忽略（防双开）', async () => {
    let release
    streamChatMock.behavior = () =>
      (async function* () {
        yield '你'
        await new Promise((r) => (release = r))
      })()
    const { stream } = mountHost()
    await flush(4)
    expect(stream.streaming.value).toBe(true)
    stream.start()
    stream.start()
    release()
    await flush(6)
    expect(stream.text.value).toBe('你') // 没有第二路流叠加
  })
})
