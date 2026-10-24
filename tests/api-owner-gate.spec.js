// api/_lib/owner.js requireOwner：站长端点公共门禁的五分支（401 未登录/401 过期/
// 503 未配置白名单/403 非站长/200 放行）。ownerEmails 纯函数见 owner-emails.spec。
// 门禁刻意不要求成员身份（首个邀请码自助引导，见 owner.js 头注）——本文件守卫
// 这一点：非成员邮箱在白名单内也放行。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const state = vi.hoisted(() => ({ client: null }))

vi.mock('../api/_lib/supabase.js', () => ({
  getServiceClient: vi.fn(() => state.client)
}))

function freshOwner() {
  vi.resetModules()
  state.client = {
    auth: { getUser: vi.fn(async (token) => state.getUser) }
  }
  return import('../api/_lib/owner.js')
}

function reqWithToken(token) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} }
}

beforeEach(() => {
  vi.stubEnv('ADMIN_EMAIL', '')
  vi.stubEnv('ADMIN_EMAILS', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('requireOwner', () => {
  it('无 Bearer token → 401 请先登录，不建 client', async () => {
    const { requireOwner } = await freshOwner()
    const out = await requireOwner(reqWithToken(''))
    expect(out).toEqual({ status: 401, error: '请先登录' })
    expect(state.client.auth.getUser).not.toHaveBeenCalled()
  })

  it('token 无效/过期 → 401 登录状态已过期', async () => {
    const { requireOwner } = await freshOwner()
    state.getUser = { data: { user: null }, error: { message: 'bad jwt' } }
    expect(await requireOwner(reqWithToken('tok'))).toEqual({ status: 401, error: '登录状态已过期，请重新登录' })
  })

  it('白名单未配置（ADMIN_EMAIL/ADMIN_EMAILS 均空）→ 503 管理功能未启用', async () => {
    const { requireOwner } = await freshOwner()
    state.getUser = { data: { user: { id: 'u1', email: 'a@b.c' } }, error: null }
    expect(await requireOwner(reqWithToken('tok'))).toEqual({ status: 503, error: '管理功能未启用' })
  })

  it('已登录但邮箱不在白名单 → 403 仅站长可访问', async () => {
    const { requireOwner } = await freshOwner()
    state.getUser = { data: { user: { id: 'u1', email: 'guest@x.com' } }, error: null }
    vi.stubEnv('ADMIN_EMAIL', 'owner@x.com')
    expect(await requireOwner(reqWithToken('tok'))).toEqual({ status: 403, error: '仅站长可访问' })
  })

  it('账号无 email（匿名/手机号认证等）→ 按 403 处理而非空引用炸掉', async () => {
    const { requireOwner } = await freshOwner()
    state.getUser = { data: { user: { id: 'u1', email: null } }, error: null }
    vi.stubEnv('ADMIN_EMAIL', 'owner@x.com')
    expect(await requireOwner(reqWithToken('tok'))).toEqual({ status: 403, error: '仅站长可访问' })
  })

  it('站长邮箱大小写与首尾空白归一后放行，返回 user 与 client', async () => {
    const { requireOwner } = await freshOwner()
    state.getUser = { data: { user: { id: 'u1', email: '  Owner@X.COM ' } }, error: null }
    vi.stubEnv('ADMIN_EMAIL', 'owner@x.com')
    const out = await requireOwner(reqWithToken('tok'))
    expect(out.status).toBeUndefined()
    expect(out.user.id).toBe('u1')
    expect(out.client).toBe(state.client)
    expect(state.client.auth.getUser).toHaveBeenCalledWith('tok')
  })

  it('ADMIN_EMAILS 全角分号分隔的多站长白名单同样放行副站长', async () => {
    const { requireOwner } = await freshOwner()
    state.getUser = { data: { user: { id: 'u2', email: 'vice@x.com' } }, error: null }
    vi.stubEnv('ADMIN_EMAILS', 'owner@x.com；vice@x.com')
    const out = await requireOwner(reqWithToken('tok'))
    expect(out.status).toBeUndefined()
    expect(out.user.id).toBe('u2')
  })
})
