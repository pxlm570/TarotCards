// api/invite/redeem handler：兑换码的归一化（空格/横线/小写容忍）、新码单候选与
// 旧版 24 位虚线码双候选兼容（inviteCodeCandidates）、以及 405/401/400/413/503 分流。
// 哈希用真实纯函数计算（invite-code.js 无副作用），rpc 全 mock。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { inviteCodeHash } from '../api/_lib/invite-code.js'

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

function reqOf(method, { token = 'tok', bodyChunks = null } = {}) {
  const req = {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {}
  }
  if (bodyChunks) {
    req[Symbol.asyncIterator] = async function* () {
      for (const chunk of bodyChunks) yield Buffer.from(chunk)
    }
  }
  return req
}

// rpc 按 p_code_hash 分发：命中的哈希返回 redeemed:true
function clientWith({ user, error, redeemHashes = [], rpcError = null }) {
  const calls = []
  return {
    rpcCalls: calls,
    auth: { getUser: vi.fn(async () => ({ data: { user }, error })) },
    rpc: vi.fn(async (name, args) => {
      calls.push({ name, args })
      if (rpcError) return { data: null, error: rpcError }
      return { data: redeemHashes.includes(args.p_code_hash) ? { redeemed: true } : null, error: null }
    })
  }
}

async function freshHandler() {
  vi.resetModules()
  return (await import('../api/invite/redeem.js')).default
}

afterEach(() => {
  vi.resetModules()
})

describe('/api/invite/redeem', () => {
  it('GET → 405 仅支持 POST', async () => {
    const handler = await freshHandler()
    const res = mockRes()
    await handler(reqOf('GET'), res)
    expect(res.statusCode).toBe(405)
    expect(JSON.parse(res.body)).toEqual({ error: '仅支持 POST' })
  })

  it('无 token → 401 请先登录', async () => {
    const handler = await freshHandler()
    const res = mockRes()
    await handler(reqOf('POST', { token: '' }), res)
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body)).toEqual({ error: '请先登录' })
  })

  it('格式无效（归一后不足 6 位）→ 400，且不查 auth、不碰 rpc', async () => {
    const handler = await freshHandler()
    state.client = clientWith({ user: { id: 'u1' } })
    const res = mockRes()
    await handler(reqOf('POST', { bodyChunks: [JSON.stringify({ code: 'ABC' })] }), res)
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toEqual({ error: '邀请码格式无效' })
    expect(state.client.auth.getUser).not.toHaveBeenCalled()
    expect(state.client.rpcCalls).toHaveLength(0)
  })

  it('粘贴带空格/横线/小写 → 归一化后按大写码哈希兑换', async () => {
    const handler = await freshHandler()
    state.client = clientWith({ user: { id: 'u1' }, redeemHashes: [inviteCodeHash('AB2CD3')] })
    const res = mockRes()
    await handler(reqOf('POST', { bodyChunks: [JSON.stringify({ code: ' ab2 cd-3 ' })] }), res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ invited: true })
    expect(state.client.rpcCalls[0].args).toEqual({ p_user_id: 'u1', p_code_hash: inviteCodeHash('AB2CD3') })
  })

  it('token 过期 → 401 登录状态已过期', async () => {
    const handler = await freshHandler()
    state.client = clientWith({ user: null, error: { message: 'bad' }, redeemHashes: [inviteCodeHash('AB2CD3')] })
    const res = mockRes()
    await handler(reqOf('POST', { bodyChunks: [JSON.stringify({ code: 'AB2CD3' })] }), res)
    expect(res.statusCode).toBe(401)
    expect(state.client.rpcCalls).toHaveLength(0)
  })

  it('旧版 24 位虚线码：两个候选形态依次尝试，第二个（带横线）命中', async () => {
    const handler = await freshHandler()
    const oldCode = 'A1B2C3D4E5F60718293A4B5C6'.slice(0, 24) // 24 位十六进制
    const dashed = oldCode.match(/.{1,4}/g).join('-')
    state.client = clientWith({ user: { id: 'u1' }, redeemHashes: [inviteCodeHash(dashed)] })
    const res = mockRes()
    await handler(reqOf('POST', { bodyChunks: [JSON.stringify({ code: dashed })] }), res)
    expect(res.statusCode).toBe(200)
    expect(state.client.rpcCalls).toHaveLength(2)
    expect(state.client.rpcCalls[0].args.p_code_hash).toBe(inviteCodeHash(oldCode))
    expect(state.client.rpcCalls[1].args.p_code_hash).toBe(inviteCodeHash(dashed))
  })

  it('所有候选都未兑换 → 400 邀请码无效、已过期或已使用', async () => {
    const handler = await freshHandler()
    const oldCode = 'A1B2C3D4E5F60718293A4B5C6'.slice(0, 24)
    state.client = clientWith({ user: { id: 'u1' } })
    const res = mockRes()
    await handler(reqOf('POST', { bodyChunks: [JSON.stringify({ code: oldCode })] }), res)
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toEqual({ error: '邀请码无效、已过期或已使用' })
    expect(state.client.rpcCalls).toHaveLength(2)
  })

  it('rpc 出错 → 503 邀请码服务暂不可用', async () => {
    const handler = await freshHandler()
    state.client = clientWith({ user: { id: 'u1' }, rpcError: { message: 'db down' } })
    const res = mockRes()
    await handler(reqOf('POST', { bodyChunks: [JSON.stringify({ code: 'AB2CD3' })] }), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ error: '邀请码服务暂不可用' })
  })

  it('body 超过 4096 字节 → readJson 413 透传', async () => {
    const handler = await freshHandler()
    state.client = clientWith({ user: { id: 'u1' } })
    const res = mockRes()
    const huge = JSON.stringify({ code: 'AB2CD3', pad: 'x'.repeat(5000) })
    await handler(reqOf('POST', { bodyChunks: [huge] }), res)
    expect(res.statusCode).toBe(413)
    expect(JSON.parse(res.body).error).toBe('请求内容过大')
  })
})
