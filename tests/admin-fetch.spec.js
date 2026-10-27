// src/lib/admin-fetch：站长三页统一取数——带 Supabase 会话 token、401/403/503
// 原样返回由页面分流、非 JSON 响应体回退 {}、网络异常回退 {status:0}。
// isolate:false：supabase 模块用工厂 getter 返回活值 + 每例 resetModules 动态导入。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const holder = vi.hoisted(() => ({ supabase: null }))

vi.mock('../src/lib/supabase.js', () => ({
  get supabase() {
    return holder.supabase
  }
}))

async function fresh() {
  vi.resetModules()
  return import('../src/lib/admin-fetch.js')
}

function sessionWith(token) {
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: token ? { session: { access_token: token } } : {} }))
    }
  }
}

let fetchMock

beforeEach(() => {
  holder.supabase = sessionWith('tok-1')
  fetchMock = vi.fn(async () => ({ status: 200, ok: true, json: async () => ({ hello: 'world' }) }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('adminFetch', () => {
  it('带会话 token 调用：Authorization 头、no-store 缓存、原样返回 status/body', async () => {
    const { adminFetch } = await fresh()
    const out = await adminFetch('/api/admin/stats')
    expect(out).toEqual({ status: 200, body: { hello: 'world' } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/stats')
    expect(init.headers.Authorization).toBe('Bearer tok-1')
    expect(init.cache).toBe('no-store')
  })

  it('自定义 headers 与 Authorization 合并且不丢', async () => {
    const { adminFetch } = await fresh()
    await adminFetch('/api/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    const init = fetchMock.mock.calls[0][1]
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.headers.Authorization).toBe('Bearer tok-1')
  })

  it('无会话（未登录）→ {status:401, body:{}}，不发起 fetch', async () => {
    holder.supabase = sessionWith(null)
    const { adminFetch } = await fresh()
    const out = await adminFetch('/api/admin/stats')
    expect(out).toEqual({ status: 401, body: {} })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('403/503 等非 2xx 状态原样透传（页面据此分流 denied/error）', async () => {
    const { adminFetch } = await fresh()
    fetchMock.mockResolvedValueOnce({ status: 403, ok: false, json: async () => ({ error: '仅站长可访问' }) })
    expect(await adminFetch('/x')).toEqual({ status: 403, body: { error: '仅站长可访问' } })
    fetchMock.mockResolvedValueOnce({ status: 503, ok: false, json: async () => ({ error: 'x' }) })
    expect((await adminFetch('/x')).status).toBe(503)
  })

  it('响应体非 JSON → body 回退 {}，状态码保留', async () => {
    const { adminFetch } = await fresh()
    fetchMock.mockResolvedValueOnce({ status: 502, ok: false, json: async () => { throw new Error('bad body') } })
    expect(await adminFetch('/x')).toEqual({ status: 502, body: {} })
  })

  it('fetch 网络异常 → {status:0, body:{}}', async () => {
    const { adminFetch } = await fresh()
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    expect(await adminFetch('/x')).toEqual({ status: 0, body: {} })
  })

  it('supabase 未配置（模块为 null）→ getSession 不可用走 catch，同样 {status:0}（当前行为）', async () => {
    holder.supabase = null
    const { adminFetch } = await fresh()
    expect(await adminFetch('/x')).toEqual({ status: 0, body: {} })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
