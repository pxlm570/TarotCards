// /api/log handler。加载期路径守卫（2026-10-16）：文件在 api/ 根目录，若被改成
// '../_lib' 写法，模块求值即 ERR_MODULE_NOT_FOUND，freshHandler 的动态导入会直接
// 失败——本文件的每次 import 本身就是这条回归的守卫（Vercel 上表现为对任意方法
// 报 FUNCTION_INVOCATION_FAILED，handler 内的 405/401 根本执行不到）。
// 鉴权后路径（2026-10-24）：getAuthorizedUser 按真实语义 mock——空 token 返回 401，
// 有 token 返回 state.access（client 为可记录 from/insert 调用的假对象）。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  access: null, // 已授权时 getAuthorizedUser 的返回值
  authThrows: null // 置位时 getAuthorizedUser 直接抛错（服务故障路径）
}))

vi.mock('../api/_lib/supabase.js', () => ({
  getServiceClient: vi.fn(),
  getAuthorizedUser: vi.fn(async (token) => {
    if (state.authThrows) throw state.authThrows
    if (!token) return { error: '请先登录', status: 401 }
    return state.access
  })
}))

// 假 supabase client：只实现 handler 用到的 from('app_events').insert 链
function memberClient({ insertError = null } = {}) {
  const client = {
    fromCalls: [],
    inserts: [],
    from(table) {
      client.fromCalls.push(table)
      return {
        insert: async (rows) => {
          client.inserts.push(rows)
          return { data: null, error: insertError }
        }
      }
    }
  }
  return client
}

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

function reqOf(method, body, token = 'tok-1') {
  const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {} }
  if (body !== undefined) {
    req[Symbol.asyncIterator] = async function* () {
      yield Buffer.from(JSON.stringify(body))
    }
  }
  return req
}

async function freshHandler() {
  vi.resetModules()
  return (await import('../api/log.js')).default
}

beforeEach(() => {
  state.access = { user: { id: 'u1', email: 'm@x.com' }, client: memberClient() }
  state.authThrows = null
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('/api/log 未认证请求', () => {
  it('模块可加载，GET 返回 405', async () => {
    const res = mockRes()
    await (await freshHandler())({ method: 'GET', headers: {} }, res)
    expect(res.statusCode).toBe(405)
    expect(JSON.parse(res.body)).toEqual({ error: '仅支持 POST' })
  })

  it('POST 无凭证返回 401，而不是抛错', async () => {
    const res = mockRes()
    await (await freshHandler())({ method: 'POST', headers: {} }, res)
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body)).toEqual({ error: '请先登录' })
  })
})

describe('/api/log 鉴权后路径', () => {
  it('白名单事件逐条入库：accepted 数与 user_id/name/path 一致，无 path 归一 null', async () => {
    const res = mockRes()
    await (await freshHandler())(
      reqOf('POST', {
        events: [
          { name: 'page_view', path: '/reading' },
          { name: 'daily_draw' },
          { name: 'reading_complete', path: '/journal' }
        ]
      }),
      res
    )
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ accepted: 3 })
    expect(state.access.client.fromCalls).toEqual(['app_events'])
    expect(state.access.client.inserts[0]).toEqual([
      { user_id: 'u1', name: 'page_view', path: '/reading' },
      { user_id: 'u1', name: 'daily_draw', path: null },
      { user_id: 'u1', name: 'reading_complete', path: '/journal' }
    ])
  })

  it('非白名单事件名与畸形条目被丢弃；全部非法时 accepted:0 且不触库', async () => {
    const handler = await freshHandler()
    const mixed = mockRes()
    await handler(
      reqOf('POST', {
        events: [{ name: 'page_view', path: '/' }, { name: 'injected_event' }, null, { path: '/no-name' }, 42]
      }),
      mixed
    )
    expect(mixed.statusCode).toBe(200)
    expect(JSON.parse(mixed.body)).toEqual({ accepted: 1 })
    expect(state.access.client.inserts[0]).toEqual([{ user_id: 'u1', name: 'page_view', path: '/' }])

    state.access.client = memberClient()
    const none = mockRes()
    await handler(reqOf('POST', { events: [{ name: 'nope' }, 42] }), none)
    expect(JSON.parse(none.body)).toEqual({ accepted: 0 })

    state.access.client = memberClient()
    const nonArray = mockRes()
    await handler(reqOf('POST', { events: 'not-array' }), nonArray)
    expect(JSON.parse(nonArray.body)).toEqual({ accepted: 0 })
    expect(state.access.client.fromCalls).toHaveLength(0)
    expect(state.access.client.inserts).toHaveLength(0)
  })

  it('events 超过 50 条只收前 50', async () => {
    const res = mockRes()
    const events = Array.from({ length: 55 }, (_, i) => ({ name: 'page_view', path: `/p${i}` }))
    await (await freshHandler())(reqOf('POST', { events }), res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ accepted: 50 })
    const rows = state.access.client.inserts[0]
    expect(rows).toHaveLength(50)
    expect(rows[0].path).toBe('/p0')
    expect(rows[49].path).toBe('/p49')
  })

  it('path 超长截到 120；非字符串/空串 path 归一 null', async () => {
    const res = mockRes()
    await (await freshHandler())(
      reqOf('POST', {
        events: [
          { name: 'page_view', path: `/${'x'.repeat(300)}` },
          { name: 'page_view', path: 123 },
          { name: 'page_view', path: '' },
          { name: 'page_view' }
        ]
      }),
      res
    )
    const rows = state.access.client.inserts[0]
    expect(rows[0].path).toBe(`/${'x'.repeat(119)}`)
    expect(rows[1].path).toBeNull()
    expect(rows[2].path).toBeNull()
    expect(rows[3].path).toBeNull()
  })

  it('insert 报错 → 503 统计写入失败', async () => {
    state.access.client = memberClient({ insertError: { message: 'db down' } })
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { events: [{ name: 'page_view', path: '/' }] }), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ error: '统计写入失败' })
  })

  it('getAuthorizedUser 抛错（服务故障）→ 503 统计服务暂不可用', async () => {
    state.authThrows = new Error('db down')
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { events: [{ name: 'page_view', path: '/' }] }), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ error: '统计服务暂不可用' })
  })
})
