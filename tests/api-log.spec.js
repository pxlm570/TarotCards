// /api/log 加载期路径（2026-10-16）：文件在 api/ 根目录。误用 ../_lib 会在模块
// 求值时 ERR_MODULE_NOT_FOUND，Vercel 对 GET/POST 都报 FUNCTION_INVOCATION_FAILED，
// handler 内的 405/401 执行不到。本文件能被 import 本身就是这条回归的守卫。
import { describe, it, expect } from 'vitest'
import handler from '../api/log.js'

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

describe('/api/log 未认证请求', () => {
  it('模块可加载，GET 返回 405', async () => {
    const res = mockRes()
    await handler({ method: 'GET', headers: {} }, res)
    expect(res.statusCode).toBe(405)
    expect(JSON.parse(res.body)).toEqual({ error: '仅支持 POST' })
  })

  it('POST 无凭证返回 401，而不是抛错', async () => {
    const res = mockRes()
    await handler({ method: 'POST', headers: {} }, res)
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body)).toEqual({ error: '请先登录' })
  })
})
