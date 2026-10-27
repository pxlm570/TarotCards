// api/_lib/http.js：三个纯工具的契约守卫。sendJson 的头与正文、bearerToken
// 对 scheme 大小写/空白的容忍、readJson 的分块拼接与 413（超限）/400（坏 JSON）
// 状态码——各 api handler 的错误分流都依赖这两个 statusCode。
import { describe, it, expect } from 'vitest'
import { sendJson, bearerToken, readJson } from '../api/_lib/http.js'

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

// Node http 请求体是 async iterable；用生成器模拟分块到达
function reqOf(chunks, headers = {}) {
  return {
    headers,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield Buffer.from(chunk)
    }
  }
}

describe('sendJson', () => {
  it('设置状态码、JSON 头与 no-store，正文为 JSON 串', () => {
    const res = mockRes()
    sendJson(res, 403, { error: '仅站长可访问' })
    expect(res.statusCode).toBe(403)
    expect(res.headers['Content-Type']).toBe('application/json; charset=utf-8')
    expect(res.headers['Cache-Control']).toBe('no-store')
    expect(JSON.parse(res.body)).toEqual({ error: '仅站长可访问' })
  })

  it('中文正文按 UTF-8 序列化不乱码', () => {
    const res = mockRes()
    sendJson(res, 200, { message: '今天的 AI 解读次数已用完' })
    expect(Buffer.from(res.body, 'utf8').toString('utf8')).toContain('次数已用完')
  })
})

describe('bearerToken', () => {
  it('标准 Bearer 头取出 token', () => {
    expect(bearerToken({ headers: { authorization: 'Bearer tok-123' } })).toBe('tok-123')
  })

  it('scheme 大小写不敏感，多余空白容忍', () => {
    expect(bearerToken({ headers: { authorization: 'bearer   tok-123' } })).toBe('tok-123')
    expect(bearerToken({ headers: { authorization: 'BEARER tok-123' } })).toBe('tok-123')
  })

  it('缺失头 / 非 Bearer scheme / 空值都返回空串', () => {
    expect(bearerToken({ headers: {} })).toBe('')
    expect(bearerToken({ headers: { authorization: 'Basic dXNlcg==' } })).toBe('')
    expect(bearerToken({ headers: { authorization: 'Bearer ' } })).toBe('')
  })
})

describe('readJson', () => {
  it('多个 chunk 拼接后解析为对象', async () => {
    const body = await readJson(reqOf(['{"cod', 'e":"AB2CD3"}']))
    expect(body).toEqual({ code: 'AB2CD3' })
  })

  it('空 body 抛 statusCode 400（JSON.parse 空串失败路径）', async () => {
    await expect(readJson(reqOf([]))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('坏 JSON 抛 statusCode 400', async () => {
    await expect(readJson(reqOf(['{oops']))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('累计字节超过 maxBytes 抛 statusCode 413', async () => {
    const big = 'x'.repeat(60000)
    await expect(readJson(reqOf([big, big]), 96 * 1024)).rejects.toMatchObject({ statusCode: 413 })
  })

  it('恰好等于 maxBytes 不抛（边界是严格大于）', async () => {
    const exact = JSON.stringify({ a: 'x'.repeat(1024 - 8) }) // 1024 字节整
    expect(Buffer.byteLength(exact)).toBe(1024)
    await expect(readJson(reqOf([exact]), 1024)).resolves.toEqual(JSON.parse(exact))
  })
})
