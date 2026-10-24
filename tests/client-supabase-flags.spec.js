// src/lib/supabase（前端环境开关模块）：四个 VITE_ 开关的解析口径与客户端创建
// 分支——这是「未配置变量=纯静态版」兼容层的根。isolate:false：每例 resetModules
// 动态导入取当前 stubEnv 下的求值结果；createClient 用真实实现（构造不发网络）。
import { describe, it, expect, afterEach, vi } from 'vitest'

async function freshFlags() {
  vi.resetModules()
  return import('../src/lib/supabase.js')
}

const ENV_KEYS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_REQUIRE_INVITE', 'VITE_DEFAULT_AI_ENABLED', 'VITE_ALLOW_CUSTOM_AI']

afterEach(() => {
  for (const key of ENV_KEYS) vi.unstubAllEnvs()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('src/lib/supabase：环境开关', () => {
  it('全未配置：四个开关均为关闭/默认态，supabase 客户端为 null（纯静态版）', async () => {
    for (const key of ENV_KEYS) vi.stubEnv(key, '')
    const mod = await freshFlags()
    expect(mod.isSupabaseConfigured).toBe(false)
    expect(mod.inviteGateRequired).toBe(false)
    expect(mod.defaultAIEnabled).toBe(false)
    expect(mod.customAIAllowed).toBe(true) // 未显式关闭视为允许，保持静态版原行为
    expect(mod.supabase).toBeNull()
  })

  it('只配 URL 不配 anon key → 仍视为未配置，客户端为 null', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const mod = await freshFlags()
    expect(mod.isSupabaseConfigured).toBe(false)
    expect(mod.supabase).toBeNull()
  })

  it('URL 与 anon key 齐备 → 已配置，创建真实客户端实例', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-for-tests')
    const mod = await freshFlags()
    expect(mod.isSupabaseConfigured).toBe(true)
    expect(mod.supabase).toBeTruthy()
    expect(typeof mod.supabase.auth.getSession).toBe('function')
  })

  it('VITE_REQUIRE_INVITE 严格等值 true 才开门禁（大小写敏感）', async () => {
    vi.stubEnv('VITE_REQUIRE_INVITE', 'true')
    expect((await freshFlags()).inviteGateRequired).toBe(true)
    vi.stubEnv('VITE_REQUIRE_INVITE', 'True')
    expect((await freshFlags()).inviteGateRequired).toBe(false)
    vi.stubEnv('VITE_REQUIRE_INVITE', '1')
    expect((await freshFlags()).inviteGateRequired).toBe(false)
  })

  it('VITE_ALLOW_CUSTOM_AI 严格等值 false 才隐藏自定义入口', async () => {
    vi.stubEnv('VITE_ALLOW_CUSTOM_AI', 'false')
    expect((await freshFlags()).customAIAllowed).toBe(false)
    vi.stubEnv('VITE_ALLOW_CUSTOM_AI', 'FALSE')
    expect((await freshFlags()).customAIAllowed).toBe(true)
  })

  it('VITE_DEFAULT_AI_ENABLED 严格等值 true 才启用默认 AI', async () => {
    vi.stubEnv('VITE_DEFAULT_AI_ENABLED', 'true')
    expect((await freshFlags()).defaultAIEnabled).toBe(true)
    vi.stubEnv('VITE_DEFAULT_AI_ENABLED', 'yes')
    expect((await freshFlags()).defaultAIEnabled).toBe(false)
  })
})
