// /api/invite/create handler（站长 GUI 生成邀请码）：405/门禁透传、days 归一
//（1–3650 整数，非法一律回落 14；字符串数字可解析）、库里只存 SHA-256 哈希、
// 有效期从当前时刻起算、insert 失败 503。generateInviteCode/hash 用真实纯函数。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { INVITE_CODE_ALPHABET, inviteCodeHash } from '../api/_lib/invite-code.js'

const state = vi.hoisted(() => ({ owner: null }))

vi.mock('../api/_lib/owner.js', () => ({
  requireOwner: vi.fn(async () => state.owner)
}))

const inserts = []

function ownerClient({ insertError = null } = {}) {
  return {
    from: vi.fn((table) => {
      expect(table).toBe('beta_invite_codes')
      return {
        insert: vi.fn(async (args) => {
          inserts.push(args)
          return insertError ? { data: null, error: insertError } : { data: null, error: null }
        })
      }
    })
  }
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

function reqOf(method, { bodyChunks = null } = {}) {
  const req = { method, headers: { authorization: 'Bearer tok' } }
  if (bodyChunks) {
    req[Symbol.asyncIterator] = async function* () {
      for (const chunk of bodyChunks) yield Buffer.from(chunk)
    }
  }
  return req
}

async function freshHandler() {
  vi.resetModules()
  return (await import('../api/invite/create.js')).default
}

const NOW = new Date('2026-03-10T04:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  inserts.length = 0
  state.owner = { user: { id: 'owner', email: 'owner@x.com' }, client: ownerClient() }
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
})

describe('/api/invite/create', () => {
  it('GET → 405 仅支持 POST', async () => {
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    expect(res.statusCode).toBe(405)
    expect(JSON.parse(res.body)).toEqual({ error: '仅支持 POST' })
    expect(inserts).toHaveLength(0)
  })

  it('非站长 403 / 未登录 401 原样透传', async () => {
    for (const denied of [{ status: 401, error: '请先登录' }, { status: 403, error: '仅站长可访问' }]) {
      state.owner = denied
      const res = mockRes()
      await (await freshHandler())(reqOf('POST', { bodyChunks: ['{}'] }), res)
      expect(res.statusCode).toBe(denied.status)
      expect(JSON.parse(res.body)).toEqual({ error: denied.error })
    }
    expect(inserts).toHaveLength(0)
  })

  it('默认 14 天：无 body 时有效期=当前时刻+14 天，响应回显 code 与 days', async () => {
    const res = mockRes()
    await (await freshHandler())(reqOf('POST'), res)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.days).toBe(14)
    expect(body.code).toMatch(new RegExp(`^[${INVITE_CODE_ALPHABET}]{6}$`))
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toEqual({
      code_hash: inviteCodeHash(body.code),
      expires_at: '2026-03-24T04:00:00.000Z'
    })
    // 明文 code 不落库，库里只有哈希
    expect(JSON.stringify(inserts[0])).not.toContain(body.code)
  })

  it('自定义天数合法区间：1 与 3650（长期有效）都按值生效', async () => {
    const handler = await freshHandler()
    for (const days of [1, 7, 3650]) {
      inserts.length = 0
      const res = mockRes()
      await handler(reqOf('POST', { bodyChunks: [JSON.stringify({ days })] }), res)
      expect(JSON.parse(res.body).days).toBe(days)
      expect(inserts[0].expires_at).toBe(new Date(NOW.getTime() + days * 86_400_000).toISOString())
    }
  })

  it('天数非法（0/负数/超上限/小数/非数字）一律回落 14', async () => {
    const handler = await freshHandler()
    for (const days of [0, -5, 3651, 1.5, 'abc', null, Infinity]) {
      const res = mockRes()
      await handler(reqOf('POST', { bodyChunks: [JSON.stringify({ days })] }), res)
      expect(JSON.parse(res.body).days, String(days)).toBe(14)
    }
  })

  it('数字字符串可解析为整数时生效（表单提交常见形态）', async () => {
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { bodyChunks: [JSON.stringify({ days: '30' })] }), res)
    expect(JSON.parse(res.body).days).toBe(30)
  })

  it('body 为坏 JSON → readJson 被 catch 吞掉，按默认 14 天建码（当前行为）', async () => {
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { bodyChunks: ['{not-json'] }), res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).days).toBe(14)
    expect(inserts).toHaveLength(1)
  })

  it('insert 失败 → 503 邀请码创建失败', async () => {
    state.owner = { user: { id: 'owner' }, client: ownerClient({ insertError: { message: 'db down' } }) }
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { bodyChunks: ['{}'] }), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ error: '邀请码创建失败' })
  })

  it('连发两码不重复且各自哈希入库', async () => {
    const handler = await freshHandler()
    const codes = []
    for (let i = 0; i < 2; i++) {
      const res = mockRes()
      await handler(reqOf('POST', { bodyChunks: ['{}'] }), res)
      codes.push(JSON.parse(res.body).code)
    }
    expect(new Set(codes).size).toBe(2)
    expect(inserts.map((i) => i.code_hash)).toEqual(codes.map((c) => inviteCodeHash(c)))
  })
})
