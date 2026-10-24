// auth 状态机门禁（2026-09-26 修复注册断点）：/api/auth/me 对「已登录未兑换成员」
// 返回 403 invited:false 是正常语义，前端此前把一切非 2xx 都当异常，导致新注册用户
// 永远卡在 service-error 红字、走不到邀请码输入。本 spec 守卫四种分支：
// 200 invited=active / 403 invited:false=invite-needed（含 owner 标志）/ 401=signed-out / 5xx=service-error。
// supabase.js 是 import 时常量：mock 工厂用 getter 读外部 holder 返回活值
// （isolate:false 下 resetModules 不重跑工厂，快照值会被冻结——同 default-ai-flag.spec 约定）。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const flags = vi.hoisted(() => {
  const auth = {
    getSession: vi.fn(async () => ({
      data: { session: { access_token: 'tok-1', user: { email: 'a@b.c' } } },
      error: null
    })),
    onAuthStateChange: vi.fn((cb) => { flags.authCallback = cb }),
    signOut: vi.fn(async () => ({})),
    signUp: vi.fn(async () => ({ data: { session: null, user: {} }, error: null })),
    signInWithPassword: vi.fn(async () => ({
      data: { session: { access_token: 'tok-new', user: { email: 'a@b.c' } } },
      error: null
    }))
  }
  return { configured: true, required: true, auth, authCallback: null }
})

vi.mock('../src/lib/supabase.js', () => ({
  get isSupabaseConfigured() { return flags.configured },
  get inviteGateRequired() { return flags.required },
  defaultAIEnabled: false,
  customAIAllowed: false,
  get supabase() { return flags.configured ? { auth: flags.auth } : null }
}))

function stubMe(status, body) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  })))
}

// queueMicrotask 回调 + updateAccess 的 fetch 链：微任务多跳后补一个宏任务兜底
async function settle() {
  for (let i = 0; i < 16; i++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('auth store：initialize 状态机', () => {
  beforeEach(() => {
    // isolate:false 下同 worker 的兄弟 spec（如 access-view-notice）可能先缓存
    // 带不同 mock 的 supabase.js/auth.js——resetModules 强制本文件工厂重新套用
    vi.resetModules()
    vi.clearAllMocks()
    flags.authCallback = null
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    flags.configured = true
    flags.required = true
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

  it('initialize 幂等：并发与重复调用只取一次会话、只注册一次监听', async () => {
    stubMe(200, { invited: true })
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    await Promise.all([auth.initialize(), auth.initialize()])
    await auth.initialize()
    expect(auth.state).toBe('active')
    expect(flags.auth.getSession).toHaveBeenCalledTimes(1)
    expect(flags.auth.onAuthStateChange).toHaveBeenCalledTimes(1)
  })

  it('getSession 自身报错或抛异常 -> service-error（区别于 fetch 网络失败）', async () => {
    flags.auth.getSession.mockResolvedValueOnce({
      data: { session: null }, error: { message: 'refresh token 无效' }
    })
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    await auth.initialize()
    expect(auth.state).toBe('service-error')

    setActivePinia(createPinia())
    flags.auth.getSession.mockRejectedValueOnce(new Error('storage broken'))
    const auth2 = useAuthStore()
    await auth2.initialize()
    expect(auth2.state).toBe('service-error')
  })

  it('Supabase 未配置 -> config-error（不发起会话请求）', async () => {
    flags.configured = false
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    await auth.initialize()
    expect(auth.state).toBe('config-error')
    expect(flags.auth.getSession).not.toHaveBeenCalled()
  })

  it('inviteGateRequired=false：状态直接 open，不查会话不拉门禁', async () => {
    flags.required = false
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    expect(auth.state).toBe('open')
    await auth.initialize()
    expect(auth.state).toBe('open')
    expect(flags.auth.getSession).not.toHaveBeenCalled()
  })

  it('onAuthStateChange：事件经微任务分流；PASSWORD_RECOVERY 置 recovering、登出清零', async () => {
    stubMe(200, { invited: true, owner: false })
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    await auth.initialize()
    expect(typeof flags.authCallback).toBe('function')

    flags.authCallback('PASSWORD_RECOVERY', { access_token: 'rec', user: { email: 'a@b.c' } })
    expect(auth.recovering).toBe(true)
    await settle()
    expect(auth.state).toBe('active')
    expect(auth.email).toBe('a@b.c')

    flags.authCallback('SIGNED_OUT', null)
    await settle()
    expect(auth.state).toBe('signed-out')
    expect(auth.recovering).toBe(false)
    expect(auth.session).toBeNull()
  })
})

describe('auth store：账号动作、邀请码兑换与降级守卫', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    flags.authCallback = null
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    flags.configured = true
    flags.required = true
  })

  it('signUp：邮箱 trim；带会话时走门禁分流（未兑换 -> invite-needed）', async () => {
    flags.auth.signUp.mockResolvedValueOnce({
      data: { session: { access_token: 'tok-n', user: { email: 'a@b.c' } } },
      error: null
    })
    stubMe(403, { invited: false, owner: false })
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    await auth.signUp({ email: '  a@b.c  ', password: 'password-8' })
    expect(flags.auth.signUp).toHaveBeenCalledWith({ email: 'a@b.c', password: 'password-8' })
    expect(auth.state).toBe('invite-needed')
    expect(auth.email).toBe('a@b.c')
  })

  it('signUp：服务端返回 error 原样抛出，不进入门禁查询', async () => {
    flags.auth.signUp.mockResolvedValueOnce({ data: {}, error: { message: 'User already registered' } })
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    await expect(auth.signUp({ email: 'a@b.c', password: 'password-8' }))
      .rejects.toMatchObject({ message: 'User already registered' })
    expect(auth.state).toBe('loading')
  })

  it('redeem：无会话直接拒绝；有会话 POST /api/invite/redeem 后重新分流到 active', async () => {
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    await expect(auth.redeem('AB2CD3')).rejects.toThrow('请先登录或创建账号。')

    auth.session = { access_token: 'tok-9' }
    const fetchMock = vi.fn(async (url, init) => {
      if (String(url).includes('/api/invite/redeem')) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) }
      }
      return { ok: true, status: 200, json: async () => ({ invited: true, owner: false, email: 'a@b.c' }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    await auth.redeem('AB2CD3')
    const redeemCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/invite/redeem'))
    expect(redeemCall[1].method).toBe('POST')
    expect(redeemCall[1].headers.Authorization).toBe('Bearer tok-9')
    expect(JSON.parse(redeemCall[1].body)).toEqual({ code: 'AB2CD3' })
    expect(auth.state).toBe('active')
  })

  it('redeem：兑换接口非 2xx 透传服务端 error，空 error 回落通用文案', async () => {
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    auth.session = { access_token: 'tok-9' }

    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/api/invite/redeem')) {
        return { ok: false, status: 400, json: async () => ({ error: '邀请码无效或已用过' }) }
      }
      return { ok: true, status: 200, json: async () => ({ invited: true }) }
    }))
    await expect(auth.redeem('BADCODE')).rejects.toThrow('邀请码无效或已用过')

    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/api/invite/redeem')) {
        return { ok: false, status: 500, json: async () => ({}) }
      }
      return { ok: true, status: 200, json: async () => ({ invited: true }) }
    }))
    await expect(auth.redeem('BADCODE')).rejects.toThrow('请求失败，请稍后再试。')
  })

  it('signOut：通知 supabase 登出并回到 signed-out、清 recovering', async () => {
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    auth.session = { access_token: 'tok-9', user: { email: 'a@b.c' } }
    auth.recovering = true
    await auth.signOut()
    expect(flags.auth.signOut).toHaveBeenCalledTimes(1)
    expect(auth.session).toBeNull()
    expect(auth.email).toBe('')
    expect(auth.recovering).toBe(false)
    expect(auth.state).toBe('signed-out')
  })

  it('supabase 缺失时账号动作与找回密码一律抛「登录服务尚未配置」', async () => {
    flags.configured = false
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    await expect(auth.signUp({ email: 'a@b.c', password: 'x' })).rejects.toThrow('登录服务尚未配置。')
    await expect(auth.signIn({ email: 'a@b.c', password: 'x' })).rejects.toThrow('登录服务尚未配置。')
    await expect(auth.requestPasswordReset('a@b.c')).rejects.toThrow('登录服务尚未配置。')
    await expect(auth.updatePassword('new-password')).rejects.toThrow('登录服务尚未配置。')
    await expect(auth.resendConfirmation('a@b.c')).rejects.toThrow('登录服务尚未配置。')
  })
})
