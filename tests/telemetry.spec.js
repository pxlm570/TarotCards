// 匿名统计客户端（telemetry）：批量节流 + 静默失败。mock supabase 用 getter 工厂
// 提供活值 + resetModules 动态导入（isolate:false 共享注册表的既有坑，见
// default-ai-flag.spec）；假时钟用完必须 useRealTimers（e5f81e4 同族教训）。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const flags = vi.hoisted(() => ({ token: 'tok-1' }))

vi.mock('../src/lib/supabase.js', () => ({
  isSupabaseConfigured: true,
  inviteGateRequired: false,
  defaultAIEnabled: false,
  customAIAllowed: false,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: flags.token } } }))
    }
  }
}))

async function importFresh() {
  vi.resetModules()
  return {
    track: (await import('../src/lib/telemetry.js')).track,
    flush: (await import('../src/lib/telemetry.js')).flush
  }
}

describe('telemetry：批量上报', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    flags.token = 'tok-1'
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('攒批到阈值立即上报，路径截断 120 字', async () => {
    const { track } = await importFresh()
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const longPath = `/${'x'.repeat(300)}`
    for (let i = 0; i < 12; i++) track('page_view', longPath)
    await vi.runOnlyPendingTimersAsync()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/log')
    expect(init.headers.Authorization).toBe('Bearer tok-1')
    const body = JSON.parse(init.body)
    expect(body.events).toHaveLength(12)
    expect(body.events[0].path).toHaveLength(120)
  })

  it('不足阈值走 5 秒定时上报', async () => {
    const { track, flush } = await importFresh()
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    track('page_view', '/reading')
    track('daily_draw')
    expect(fetchMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).events).toHaveLength(2)
    // flush 后队列清空，重复 flush 不再发请求
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('无登录态时静默丢弃整批，不发请求', async () => {
    flags.token = ''
    const { track, flush } = await importFresh()
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    track('page_view', '/')
    await flush()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// 静默失败契约：统计永不影响功能（2026-09-26 红线）。空事件名不入队不发请求；
// flush 遇网络故障整批丢弃不重试（队列在 try 之前已 splice 清空）。
describe('telemetry：静默失败与非法事件名', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    flags.token = 'tok-1'
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('空事件名（空串/null）不入队不发请求', async () => {
    const { track, flush } = await importFresh()
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    track('', '/spoof')
    track(null, '/spoof')
    expect(fetchMock).not.toHaveBeenCalled()
    // 队列里只有后补的合法事件 → 空名确实没入队
    track('page_view', '/')
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).events).toEqual([{ name: 'page_view', path: '/' }])
  })

  it('flush 时 fetch 抛错 → 静默不炸，整批丢弃不重试', async () => {
    const { track, flush } = await importFresh()
    const fetchMock = vi.fn(async () => {
      throw new Error('network down')
    })
    vi.stubGlobal('fetch', fetchMock)
    track('page_view', '/')
    await flush() // 不抛即静默
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await flush() // 队列已清空：第二次 flush 不再发请求
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // pagehide 兜底（模块加载时注册在 window 上）：用户直接关页/切走时，
  // 不足阈值的尾部批次也要立即发出，不能等 5 秒定时器。
  it('pagehide 触发立即上报尾部批次，队列清空后不再重复发', async () => {
    const { track } = await importFresh()
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    track('page_view', '/reading')
    track('share_card', '/reading')
    window.dispatchEvent(new Event('pagehide'))
    await vi.runOnlyPendingTimersAsync() // flush 异步，让微任务落地
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer tok-1')
    expect(JSON.parse(init.body).events).toEqual([
      { name: 'page_view', path: '/reading' },
      { name: 'share_card', path: '/reading' }
    ])
    // 队列已空：再次 pagehide 与到点的 5 秒定时器都不再发请求
    window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(6000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
