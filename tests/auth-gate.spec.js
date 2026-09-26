// auth 状态机门禁（2026-09-26 修复注册断点）：/api/auth/me 对「已登录未兑换成员」
// 返回 403 invited:false 是正常语义，前端此前把一切非 2xx 都当异常，导致新注册用户
// 永远卡在 service-error 红字、走不到邀请码输入。本 spec 守卫四种分支：
// 200 invited=active / 403 invited:false=invite-needed（含 owner 标志）/ 401=signed-out / 5xx=service-error。
// supabase.js 是 import 时常量，mock 用普通工厂即可（本文件 flags 不需运行时翻转）。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../src/lib/supabase.js', () => ({
  isSupabaseConfigured: true,
  inviteGateRequired: true,
  defaultAIEnabled: false,
  customAIAllowed: false,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok-1' } }, error: null })),
      onAuthStateChange: vi.fn()
    }
  }
}))

function stubMe(status, body) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  })))
}

describe('auth store：initialize 状态机', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('200 invited=true -> active', async () => {
    stubMe(200, { invited: true, owner: true, email: 'a@b.c' })
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    await auth.initialize()
    expect(auth.state).toBe('active')
    expect(auth.owner).toBe(true)
  })

  it('403 invited=false -> invite-needed（不是 service-error），owner 标志透传', async () => {
    stubMe(403, { invited: false, owner: true, email: 'a@b.c' })
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    await auth.initialize()
    expect(auth.state).toBe('invite-needed')
    expect(auth.owner).toBe(true)
  })

  it('401 -> signed-out（引导重新登录，而非报服务错误）', async () => {
    stubMe(401, { error: '登录状态已过期', invited: false })
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    await auth.initialize()
    expect(auth.state).toBe('signed-out')
  })

  it('5xx / 网络异常 -> service-error', async () => {
    stubMe(503, { error: '服务暂不可用' })
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    await auth.initialize()
    expect(auth.state).toBe('service-error')

    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    const auth2 = useAuthStore()
    await auth2.initialize()
    expect(auth2.state).toBe('service-error')
  })
})
