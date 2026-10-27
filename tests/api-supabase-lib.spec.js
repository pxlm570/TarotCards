// api/_lib/supabase.js：服务端 service client 工厂与 getAuthorizedUser 分流。
// env 全部用测试假值 stub，不触碰真实密钥。isolate:false 下真实
// @supabase/supabase-js 可能已被同 worker 其他文件缓存——按 AGENTS.md 惯例：
// 工厂闭包 vi.hoisted 状态返回活值 + 每例 resetModules 后动态导入。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const state = vi.hoisted(() => ({ created: [], client: null, nextClient: {} }))

vi.mock('@supabase/supabase-js', () => ({
  // 假 client：auth/from 行为由各用例通过 state.nextClient 注入
  createClient: vi.fn((url, key, opts) => {
    state.client = { url, key, opts, ...state.nextClient }
    state.created.push({ url, key, opts })
    return state.client
  })
}))

let outerViteUrl

function freshModule() {
  vi.resetModules()
  state.created.length = 0
  state.nextClient = {}
  state.client = null
  return import('../api/_lib/supabase.js')
}

function withAuth({ getUser, member }) {
  state.nextClient = {
    auth: { getUser: vi.fn(async () => getUser) },
    from: vi.fn(() => {
      const q = {
        select: vi.fn(() => q),
        eq: vi.fn(() => q),
        maybeSingle: vi.fn(async () => member)
      }
      return q
    })
  }
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://stub-project.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'stub-service-role-key-for-tests')
  outerViteUrl = process.env.VITE_SUPABASE_URL
  delete process.env.VITE_SUPABASE_URL
})

afterEach(() => {
  vi.unstubAllEnvs()
  if (outerViteUrl === undefined) delete process.env.VITE_SUPABASE_URL
  else process.env.VITE_SUPABASE_URL = outerViteUrl
  vi.resetModules()
})

describe('getServiceClient', () => {
  it('env 齐全时按 URL+Key 建 client，且 auth 关自动刷新/会话持久化', async () => {
    const m = await freshModule()
    const client = m.getServiceClient()
    expect(client.url).toBe('https://stub-project.supabase.co')
    expect(client.key).toBe('stub-service-role-key-for-tests')
    expect(client.opts).toEqual({ auth: { autoRefreshToken: false, persistSession: false } })
  })

  it('缺 SUPABASE_URL 或 SERVICE_ROLE_KEY 任一项都抛错', async () => {
    const m = await freshModule()
    vi.stubEnv('SUPABASE_URL', '')
    expect(() => m.getServiceClient()).toThrow('Supabase 服务端环境变量未配置')
    vi.stubEnv('SUPABASE_URL', 'https://stub-project.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    expect(() => m.getServiceClient()).toThrow('Supabase 服务端环境变量未配置')
  })

  it('SUPABASE_URL 缺失时回落 VITE_SUPABASE_URL（服务端同源部署便利）', async () => {
    const m = await freshModule()
    vi.stubEnv('SUPABASE_URL', '')
    process.env.VITE_SUPABASE_URL = 'https://fallback.supabase.co'
    const client = m.getServiceClient()
    expect(client.url).toBe('https://fallback.supabase.co')
  })

  it('进程内单例：重复调用不重复建 client', async () => {
    const m = await freshModule()
    const a = m.getServiceClient()
    const b = m.getServiceClient()
    expect(a).toBe(b)
    expect(state.created).toHaveLength(1)
  })
})

describe('getAuthorizedUser', () => {
  it('无 token 直接 401 请先登录，不建 client 也不查 auth', async () => {
    const m = await freshModule()
    const out = await m.getAuthorizedUser('')
    expect(out).toEqual({ error: '请先登录', status: 401 })
    expect(state.client).toBeNull() // 未走到 getServiceClient
  })

  it('getUser 返回 error → 401 登录状态已过期', async () => {
    const m = await freshModule()
    withAuth({ getUser: { data: {}, error: { message: 'bad JWT' } }, member: null })
    m.getServiceClient()
    expect(await m.getAuthorizedUser('tok')).toEqual({ error: '登录状态已过期，请重新登录', status: 401 })
  })

  it('getUser 无 error 但无 user → 401', async () => {
    const m = await freshModule()
    withAuth({ getUser: { data: { user: null }, error: null }, member: null })
    m.getServiceClient()
    expect(await m.getAuthorizedUser('tok')).toMatchObject({ status: 401 })
  })

  it('成员查询出错时抛异常（由 handler 兜底 503）', async () => {
    const m = await freshModule()
    withAuth({ getUser: { data: { user: { id: 'u1' } }, error: null }, member: { data: null, error: { message: 'boom' } } })
    m.getServiceClient()
    await expect(m.getAuthorizedUser('tok')).rejects.toThrow('Supabase 邀请权限查询失败')
  })

  it('已登录但不是成员 → 403 尚未兑换邀请码', async () => {
    const m = await freshModule()
    withAuth({ getUser: { data: { user: { id: 'u1' } }, error: null }, member: { data: null, error: null } })
    m.getServiceClient()
    expect(await m.getAuthorizedUser('tok')).toEqual({ error: '该账号尚未兑换有效邀请码', status: 403 })
  })

  it('成员 → 返回 user 与 client，getUser 按 token 查、成员表按 beta_members', async () => {
    const m = await freshModule()
    withAuth({ getUser: { data: { user: { id: 'u1', email: 'a@b.c' } }, error: null }, member: { data: { user_id: 'u1' }, error: null } })
    m.getServiceClient()
    const out = await m.getAuthorizedUser('tok')
    expect(out.user.id).toBe('u1')
    expect(out.client).toBe(state.client)
    expect(state.client.auth.getUser).toHaveBeenCalledWith('tok')
    expect(state.client.from).toHaveBeenCalledWith('beta_members')
  })
})
