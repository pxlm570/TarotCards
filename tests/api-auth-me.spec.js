// api/auth/me handler：前端 auth store 的数据源。关键契约——403 invited:false 是
// 「已登录未兑换」的正常否定态（不是服务故障），且未兑换的站长也要拿到 owner:true
//（门禁页据此显示「生成首个邀请码」自助入口，见 AGENTS.md 2026-09-26 条目）。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const state = vi.hoisted(() => ({ client: null }))

vi.mock('../api/_lib/supabase.js', () => ({
  getServiceClient: vi.fn(() => state.client)
}))

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value
    },
    end(payload) {
      this.body = payload
    }
  }
}

function clientWith({ user, error, member, memberError }) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error })) },
    from: vi.fn(() => {
      const q = {
        select: vi.fn(() => q),
        eq: vi.fn(() => q),
        maybeSingle: vi.fn(async () => ({ data: member, error: memberError }))
      }
      return q
    })
  }
}

function reqOf(method, { token = 'tok' } = {}) {
  return {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {}
  }
}

async function freshHandler() {
  vi.resetModules()
  return (await import('../api/auth/me.js')).default
}

beforeEach(() => {
  vi.stubEnv('ADMIN_EMAIL', 'owner@x.com')
  vi.stubEnv('ADMIN_EMAILS', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('/api/auth/me', () => {
  it('非 GET 方法 → 405 仅支持 GET', async () => {
    const handler = await freshHandler()
    const res = mockRes()
    await handler({ method: 'POST', headers: {} }, res)
    expect(res.statusCode).toBe(405)
    expect(JSON.parse(res.body)).toEqual({ error: '仅支持 GET' })
  })

  it('token 无效 → 401 且 invited:false（前端据此回到 signed-out）', async () => {
    const handler = await freshHandler()
    state.client = clientWith({ user: null, error: { message: 'bad' } })
    const res = mockRes()
    await handler(reqOf('GET'), res)
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body)).toEqual({ error: '登录状态已过期，请重新登录', invited: false })
  })

  it('已登录未兑换 → 403 invited:false（正常否定态），owner 邮箱大小写归一后仍带 owner:true', async () => {
    const handler = await freshHandler()
    state.client = clientWith({ user: { id: 'u1', email: 'OWNER@X.COM ' }, member: null })
    const res = mockRes()
    await handler(reqOf('GET'), res)
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toEqual({ invited: false, owner: true, email: 'owner@x.com' })
  })

  it('已登录未兑换的非站长 → 403 owner:false', async () => {
    const handler = await freshHandler()
    state.client = clientWith({ user: { id: 'u1', email: 'guest@x.com' }, member: null })
    const res = mockRes()
    await handler(reqOf('GET'), res)
    expect(JSON.parse(res.body)).toEqual({ invited: false, owner: false, email: 'guest@x.com' })
  })

  it('白名单未配置 → owner 恒为 false（不炸、不误报）', async () => {
    const handler = await freshHandler()
    vi.stubEnv('ADMIN_EMAIL', '')
    state.client = clientWith({ user: { id: 'u1', email: 'owner@x.com' }, member: { user_id: 'u1' } })
    const res = mockRes()
    await handler(reqOf('GET'), res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).owner).toBe(false)
  })

  it('成员 → 200 invited:true，邮箱 trim+小写回显', async () => {
    const handler = await freshHandler()
    state.client = clientWith({ user: { id: 'u1', email: ' Member@X.com ' }, member: { user_id: 'u1' } })
    const res = mockRes()
    await handler(reqOf('GET'), res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ invited: true, owner: false, email: 'member@x.com' })
  })

  it('成员表查询出错 → 503 访问服务暂不可用', async () => {
    const handler = await freshHandler()
    state.client = clientWith({ user: { id: 'u1', email: 'a@b.c' }, member: null, memberError: { message: 'boom' } })
    const res = mockRes()
    await handler(reqOf('GET'), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ error: '访问服务暂不可用' })
  })
})
