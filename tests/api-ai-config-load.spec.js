// api/_lib/ai-config.js 的 loadAiConfig：60s 进程内缓存、读库报错、坏值归一。
// supabase service client 全程 mock，不触碰真实库。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const state = vi.hoisted(() => ({ calls: 0, result: { data: null, error: null }, keys: [] }))

vi.mock('../api/_lib/supabase.js', () => ({
  getServiceClient: () => ({
    from: (table) => {
      state.calls++
      state.table = table
      const q = {
        select: () => q,
        eq: (_col, key) => {
          state.keys.push(key)
          return q
        },
        maybeSingle: async () => state.result
      }
      return q
    }
  })
}))

import {
  loadAiConfig,
  resetAiConfigCacheForTests,
  AI_CONFIG_DEFAULTS,
  AI_CONFIG_KEY
} from '../api/_lib/ai-config.js'

describe('ai-config：loadAiConfig', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-24T00:00:00Z'))
    state.calls = 0
    state.keys = []
    state.result = { data: null, error: null }
    resetAiConfigCacheForTests()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('从 app_config 按 key=ai 读取并归一；库里没有行时回落默认值', async () => {
    const cfg = await loadAiConfig()
    expect(state.table).toBe('app_config')
    expect(state.keys).toEqual([AI_CONFIG_KEY])
    expect(cfg).toEqual(AI_CONFIG_DEFAULTS)
  })

  it('读到的 value 经 normalizeAiConfig：base_url 去尾斜杠，坏限额回落默认', async () => {
    state.result = {
      data: { value: { base_url: 'https://x.example/v1/', daily_standard_limit: 0, daily_deep_limit: 3 } },
      error: null
    }
    const cfg = await loadAiConfig()
    expect(cfg.base_url).toBe('https://x.example/v1')
    expect(cfg.daily_standard_limit).toBe(AI_CONFIG_DEFAULTS.daily_standard_limit)
    expect(cfg.daily_deep_limit).toBe(3)
  })

  it('60s 内命中缓存不再读库；满 60s 重新读取并拿到新值', async () => {
    state.result = { data: { value: { model_standard: 'm1' } }, error: null }
    const a = await loadAiConfig()
    state.result = { data: { value: { model_standard: 'm2' } }, error: null }
    vi.advanceTimersByTime(59_999)
    const b = await loadAiConfig()
    expect(state.calls).toBe(1)
    expect(b).toBe(a)
    expect(b.model_standard).toBe('m1')
    vi.advanceTimersByTime(1)
    const c = await loadAiConfig()
    expect(state.calls).toBe(2)
    expect(c.model_standard).toBe('m2')
  })

  it('读库报错 → 抛「AI 配置读取失败」且不写缓存（下次仍会重试）', async () => {
    state.result = { data: null, error: { message: 'boom' } }
    await expect(loadAiConfig()).rejects.toThrow('AI 配置读取失败')
    state.result = { data: { value: { model_deep: 'd1' } }, error: null }
    const cfg = await loadAiConfig()
    expect(cfg.model_deep).toBe('d1')
    expect(state.calls).toBe(2)
  })

  it('resetAiConfigCacheForTests 清缓存，下次必读库', async () => {
    await loadAiConfig()
    resetAiConfigCacheForTests()
    await loadAiConfig()
    expect(state.calls).toBe(2)
  })
})
