// /api/ai/config handler（站长 GUI 配置端点）：门禁透传、GET 脱敏配置+缺口清单、
// POST 白名单补丁合并保存（api_key 留空=不改、缺字段 400、upsert 失败 503）、
// 405 其他方法。requireOwner 门禁本身见 api-owner-gate.spec，此处 mock 掉。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  owner: null, // requireOwner 返回值
  row: null, // app_config 查询结果
  readError: null,
  upsertError: null
}))

vi.mock('../api/_lib/owner.js', () => ({
  requireOwner: vi.fn(async () => state.owner)
}))

function configClient() {
  const upserts = []
  const client = {
    upserts,
    from: vi.fn((table) => {
      expect(table).toBe('app_config')
      const q = {
        select: vi.fn(() => q),
        eq: vi.fn(() => q),
        maybeSingle: vi.fn(async () =>
          state.readError ? { data: null, error: state.readError } : { data: state.row, error: null }
        ),
        upsert: vi.fn(async (args) => {
          upserts.push(args)
          return state.upsertError ? { data: null, error: state.upsertError } : { data: null, error: null }
        })
      }
      return q
    })
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

function reqOf(method, { token = 'tok', bodyChunks = null } = {}) {
  const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {} }
  if (bodyChunks) {
    req[Symbol.asyncIterator] = async function* () {
      for (const chunk of bodyChunks) yield Buffer.from(chunk)
    }
  }
  return req
}

async function freshHandler() {
  vi.resetModules()
  return (await import('../api/ai/config.js')).default
}

const FULL_CONFIG = {
  base_url: 'https://llm.example/v1/',
  api_key: 'sk-owner-key-123456',
  model_standard: 'std-model',
  model_deep: 'deep-model'
}

let client

beforeEach(() => {
  client = configClient()
  state.owner = { user: { id: 'owner' }, client }
  state.row = null
  state.readError = null
  state.upsertError = null
})

afterEach(() => vi.resetModules())

describe('/api/ai/config：门禁与方法', () => {
  it('requireOwner 401/403/503 原样透传，不触库', async () => {
    for (const denied of [
      { status: 401, error: '请先登录' },
      { status: 403, error: '仅站长可访问' },
      { status: 503, error: '管理功能未启用' }
    ]) {
      state.owner = denied
      const res = mockRes()
      await (await freshHandler())(reqOf('GET'), res)
      expect(res.statusCode).toBe(denied.status)
      expect(JSON.parse(res.body)).toEqual({ error: denied.error })
    }
  })

  it('PUT → 405 仅支持 GET/POST', async () => {
    const res = mockRes()
    await (await freshHandler())(reqOf('PUT'), res)
    expect(res.statusCode).toBe(405)
    expect(JSON.parse(res.body)).toEqual({ error: '仅支持 GET/POST' })
  })
})

describe('/api/ai/config：GET', () => {
  it('返回脱敏配置（key 只露残影 + has_api_key）、缺口清单与更新时间', async () => {
    state.row = { value: FULL_CONFIG, updated_at: '2026-09-25T00:00:00Z' }
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.missing).toEqual([])
    expect(body.updated_at).toBe('2026-09-25T00:00:00Z')
    expect(body.config.api_key).toBe('sk-o…56') // 脱敏，绝不明文回传
    expect(body.config.has_api_key).toBe(true)
    expect(body.config.base_url).toBe('https://llm.example/v1') // 尾斜杠被 normalize 归一
    expect(body.config.daily_standard_limit).toBe(5) // 默认档位随行返回
  })

  it('库中无配置行 → 全默认 + 四个字符串字段全缺失', async () => {
    state.row = null
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.missing).toEqual(['base_url', 'api_key', 'model_standard', 'model_deep'])
    expect(body.config.api_key).toBe('（未设置）')
    expect(body.config.has_api_key).toBe(false)
  })

  it('读库失败 → 503 配置服务暂不可用', async () => {
    state.readError = { message: 'db down' }
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ error: '配置服务暂不可用' })
  })
})

describe('/api/ai/config：POST', () => {
  it('合法补丁与存量合并后 upsert，返回脱敏配置与空缺口', async () => {
    state.row = { value: { ...FULL_CONFIG, api_key: 'sk-old-key-999999' } }
    const res = mockRes()
    await (
      await freshHandler()
    )(reqOf('POST', { bodyChunks: [JSON.stringify({ patch: { base_url: 'https://new.example/v1', daily_deep_limit: 2 } })] }), res)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.missing).toEqual([])
    expect(body.config.base_url).toBe('https://new.example/v1')
    expect(body.config.daily_deep_limit).toBe(2)
    expect(body.config.model_standard).toBe('std-model') // 未提交字段保留存量
    // 落库的是合并后的完整 value；key 以 'ai' 写 app_config
    expect(client.upserts).toHaveLength(1)
    expect(client.upserts[0].key).toBe('ai')
    expect(client.upserts[0].value.api_key).toBe('sk-old-key-999999') // 未提交 key 不动
    expect(client.upserts[0].value.base_url).toBe('https://new.example/v1')
    expect(client.upserts[0].updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('api_key 留空（不提交）= 不改，仍用存量 key；明文永不回传', async () => {
    state.row = { value: FULL_CONFIG }
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { bodyChunks: [JSON.stringify({ patch: { base_url: 'https://new.example/v1' } })] }), res)
    const body = JSON.parse(res.body)
    expect(body.config.api_key).toBe('sk-o…56') // 存量 key 的脱敏残影
    expect(res.body).not.toContain('sk-owner-key-123456')
  })

  it('body 直接作为 patch（无 patch 包裹）同样接受', async () => {
    state.row = { value: FULL_CONFIG }
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { bodyChunks: [JSON.stringify({ model_standard: 'm-new' })] }), res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).config.model_standard).toBe('m-new')
  })

  it('补丁字段非法（空串/负数）→ 400 带字段名', async () => {
    for (const patch of [{ base_url: '  ' }, { daily_deep_limit: -1 }]) {
      const res = mockRes()
      await (await freshHandler())(reqOf('POST', { bodyChunks: [JSON.stringify({ patch })] }), res)
      expect(res.statusCode).toBe(400)
      const { error } = JSON.parse(res.body)
      expect(error).toMatch(/base_url|daily_deep_limit/)
    }
  })

  it('合并后必需字段仍缺 → 400 配置不完整（列缺口），不落库', async () => {
    state.row = null
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { bodyChunks: [JSON.stringify({ patch: { base_url: 'https://new.example/v1' } })] }), res)
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toBe('配置不完整，还缺：api_key、model_standard、model_deep')
  })

  it('upsert 失败 → 503 配置保存失败', async () => {
    state.row = { value: FULL_CONFIG }
    state.upsertError = { message: 'db down' }
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { bodyChunks: [JSON.stringify({ patch: { base_url: 'https://new.example/v1' } })] }), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ error: '配置保存失败' })
  })

  it('body 超过 8192 字节 → readJson 413 透传（带 statusCode 的错误信息原样输出）', async () => {
    state.row = { value: FULL_CONFIG }
    const res = mockRes()
    const huge = JSON.stringify({ patch: { base_url: `https://${'x'.repeat(9000)}.example/v1` } })
    await (await freshHandler())(reqOf('POST', { bodyChunks: [huge] }), res)
    expect(res.statusCode).toBe(413)
    expect(JSON.parse(res.body)).toEqual({ error: '请求内容过大' })
  })
})
