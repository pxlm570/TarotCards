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
