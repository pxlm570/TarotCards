// useStream 单测：流式生命周期统一收口（挂载即流/卸载即中止/错误分类/重试）。
// ai-client 整模块 mock 掉，用可编程的假 streamChat 驱动各分支。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

const { streamChatMock } = vi.hoisted(() => {
  // isolate:false：清掉其他组件已加载的真实 useStream，确保本文件使用下方 mock。
  vi.resetModules()
  return ({
  // 每个用例给 behavior 赋值：async function* ({ signal }) { ... }
  streamChatMock: { behavior: null }
  })
})

vi.mock('../src/lib/ai-client.js', () => ({
  streamChat: (opts) => streamChatMock.behavior(opts),
  AI_NOT_CONFIGURED: 'AI_NOT_CONFIGURED',
  AI_TIMEOUT_STATUS: 408, // use-stream.js 会导入它，mock 必须一并提供（缺失时取值即抛错）
  AIError: class AIError extends Error {
    constructor(status, message, userMessage) {
      super(message)
      this.status = status
      this.userMessage = userMessage // 流中服务端错误透传（use-stream 优先展示）
    }
  }
}))

const { useStream } = await import('../src/composables/use-stream.js')
const { AIError } = await import('../src/lib/ai-client.js')

// 挂一个宿主组件，把 useStream 返回值捞出来
const wrappers = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})
function mountHost(props = {}) {
  let exposed
  const Host = defineComponent({
    setup() {
      exposed = useStream(() => [{ role: 'user', content: 'hi' }], { immediate: true, ...props })
      return () => h('div')
    }
  })
  const wrapper = mount(Host)
  wrappers.push(wrapper)
  return { wrapper, stream: exposed }
}

// 16 个微任务：async generator 协议每 yield 约 2-3 跳，6 次曾贴着下限（高负载全量跑时间歇不够）
async function flush(times = 16) {
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
  it('主动中止保留取消状态且不算完成，重新生成后可正常完成', async () => {
    streamChatMock.behavior = async function* ({ signal }) {
      yield '半截'
      await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('停止', 'AbortError')), { once: true }))
    }
    const onDone = vi.fn()
    const { stream } = mountHost({ onDone })
    await flush()
    stream.stop()
    await flush()
    expect(stream.cancelled.value).toBe(true)
    expect(onDone).not.toHaveBeenCalled()
    streamChatMock.behavior = okStream(['完整'])
    await stream.start()
    expect(stream.cancelled.value).toBe(false)
    expect(onDone).toHaveBeenCalledWith('完整')
  })
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    streamChatMock.behavior = null
  })

  it('宿主卸载后，即使上游晚到也不写文本或触发完成回调', async () => {
    let release
    streamChatMock.behavior = async function* () {
      await new Promise((resolve) => { release = resolve })
      yield '迟到内容'
    }
    const onDone = vi.fn()
    const { wrapper, stream } = mountHost({ onDone })
    wrapper.unmount()
    release()
    await flush()
    expect(stream.text.value).toBe('')
    expect(onDone).not.toHaveBeenCalled()
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

  // ---- 补充：错误分类剩余分支、参数透传与卸载/中止守卫 ----

  it('无 userMessage 的 AIError 按状态码分类：401 密钥无效、0 落网络、500 落请求失败', async () => {
    streamChatMock.behavior = async function* () { throw new AIError(401, 'bad key') }
    const { stream } = mountHost()
    await flush()
    expect(stream.error.value).toBe('密钥无效')

    streamChatMock.behavior = async function* () { throw new AIError(0, 'conn reset') }
    stream.start()
    await flush()
    expect(stream.error.value).toBe('请求失败（网络）')

    streamChatMock.behavior = async function* () { throw new AIError(500, 'oops') }
    stream.start()
    await flush()
    expect(stream.error.value).toBe('请求失败（500）')
  })

  it('流中服务端错误携带 userMessage 时原样优先展示（半截文本保留）', async () => {
    streamChatMock.behavior = async function* () {
      yield '半截'
      throw new AIError(0, '余额不足', '余额不足')
    }
    const { stream } = mountHost()
    await flush()
    expect(stream.text.value).toBe('半截')
    expect(stream.error.value).toBe('余额不足')
  })

  it('非 AIError 的普通异常落网络错误兜底文案', async () => {
    streamChatMock.behavior = async function* () { throw new TypeError('boom') }
    const { stream } = mountHost()
    await flush()
    expect(stream.error.value).toBe('网络错误，请检查 baseUrl 或网络。')
  })

  it('start 把 tier/forceCustom 与 getMessages 结果原样透传给 streamChat', async () => {
    let captured = null
    streamChatMock.behavior = (opts) => {
      captured = opts
      return (async function* () { /* 空流 */ })()
    }
    mountHost({ tier: 'deep', forceCustom: true })
    await flush()
    expect(captured.tier).toBe('deep')
    expect(captured.forceCustom).toBe(true)
    expect(captured.messages).toEqual([{ role: 'user', content: 'hi' }])
    expect(captured.signal).toBeTruthy()
  })

  it('卸载后再 start 直接短路，不再发起流', async () => {
    streamChatMock.behavior = vi.fn(() => (async function* () { yield 'x' })())
    const { wrapper, stream } = mountHost()
    wrapper.unmount()
    streamChatMock.behavior.mockClear()
    await stream.start()
    await flush() // 等挂载即流的那一路（含被中止的收尾）落定
    expect(streamChatMock.behavior).not.toHaveBeenCalled()
    expect(stream.streaming.value).toBe(false)
  })

  it('上游不理会中止信号时，迟到增量被循环守卫丢弃且不算完成', async () => {
    let release
    const onDone = vi.fn()
    streamChatMock.behavior = () =>
      (async function* () {
        yield '半截'
        await new Promise((r) => { release = r })
        yield '迟到'
      })()
    const { stream } = mountHost({ onDone })
    await flush()
    expect(stream.text.value).toBe('半截')
    stream.stop()
    release()
    await flush()
    expect(stream.text.value).toBe('半截')
    expect(stream.cancelled.value).toBe(true)
    expect(onDone).not.toHaveBeenCalled()
    expect(stream.streaming.value).toBe(false)
  })
})
