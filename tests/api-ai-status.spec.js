// /api/ai/status handler：前端额度指示的数据源——405/401 分流、cleanup 失败 503、
// 当日用量只计 pending+succeeded（失败不占额）、限额取自统一配置（未配置回落默认
// 5/1）、deepAvailable 布尔与 standardRemaining 下限 0、日键按上海时区。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  access: null,
  configDoc: null,
  configError: null
}))

vi.mock('../api/_lib/supabase.js', () => ({
  getServiceClient: vi.fn(),
  getAuthorizedUser: vi.fn(async () => state.access)
}))

vi.mock('../api/_lib/ai-config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadAiConfig: vi.fn(async () => {
    if (state.configError) throw state.configError
    return state.configDoc
  })
}))

const CONFIG = {
  base_url: 'https://llm.example/v1',
  api_key: 'sk-k',
  model_standard: 'm1',
  model_deep: 'm2',
  daily_standard_limit: 3,
  daily_deep_limit: 2
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

function memberClient({ cleanupError = null, rows = null, queryError = null } = {}) {
  const filters = { eq: [], in: [] }
  return {
    filters,
    rpc: vi.fn(async () => (cleanupError ? { error: cleanupError } : { error: null })),
    from: vi.fn(() => {
      const q = {
        select: vi.fn(() => q),
        eq: vi.fn((...args) => {
          filters.eq.push(args)
          return q
        }),
        in: vi.fn(async (column, values) => {
          filters.in.push([column, values])
          if (queryError) return { data: null, error: queryError }
          // 模拟 DB 按 state 过滤：handler 只做计数，过滤发生在查询层
          const filtered = (rows || []).filter((row) => values.includes(row.state || 'pending'))
          return { data: filtered, error: null }
        })
      }
      return q
    })
  }
}

function reqOf(method, { token = 'tok' } = {}) {
  return { method, headers: token ? { authorization: `Bearer ${token}` } : {} }
}

async function freshHandler() {
  vi.resetModules()
  return (await import('../api/ai/status.js')).default
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-10T02:00:00Z')) // 上海 2026-03-10 10:00
  state.access = { user: { id: 'u1' }, client: memberClient() }
  state.configDoc = { ...CONFIG }
  state.configError = null
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
})

describe('/api/ai/status', () => {
  it('POST → 405 仅支持 GET', async () => {
    const res = mockRes()
    await (await freshHandler())(reqOf('POST'), res)
    expect(res.statusCode).toBe(405)
    expect(JSON.parse(res.body)).toEqual({ error: '仅支持 GET' })
  })

  it('无 token → 401 请先登录', async () => {
    state.access = { user: null, status: 401, error: '请先登录' }
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body)).toEqual({ error: '请先登录' })
  })

  it('基础查询：日键按上海时区、按当日 pending+succeeded 用量折算剩余', async () => {
    state.access.client = memberClient({
      rows: [
        { mode: 'standard' }, { mode: 'standard' },
        { mode: 'deep' },
        { mode: 'standard', state: 'failed' }, // 失败不占额
        { mode: 'deep', state: 'failed' }
      ]
    })
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({
      day: '2026-03-10',
      standardRemaining: 1, // 限额 3 - 已用 2
      deepAvailable: true // 限额 2 - 已用 1
    })
  })

  it('上海换日边界：UTC 前一天 17:00 = 上海当日，日键随之', async () => {
    vi.setSystemTime(new Date('2026-03-10T17:30:00Z')) // 上海 2026-03-11 01:30
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    expect(JSON.parse(res.body).day).toBe('2026-03-11')
  })

  it('普通档用超时剩余钳到 0，深度满额时 deepAvailable=false', async () => {
    state.access.client = memberClient({
      rows: [
        { mode: 'standard' }, { mode: 'standard' }, { mode: 'standard' }, { mode: 'standard' },
        { mode: 'deep' }, { mode: 'deep' }
      ]
    })
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    const body = JSON.parse(res.body)
    expect(body.standardRemaining).toBe(0)
    expect(body.deepAvailable).toBe(false)
  })

  it('配置未齐 → 回落默认限额 5/1（展示口径，权威校验仍在 chat 预留）', async () => {
    state.configDoc = {}
    state.access.client = memberClient({ rows: [{ mode: 'standard' }] })
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    const body = JSON.parse(res.body)
    expect(body.standardRemaining).toBe(4)
    expect(body.deepAvailable).toBe(true)
  })

  it('loadAiConfig 抛错同样回落默认限额，不拒服', async () => {
    state.configError = new Error('db down')
    state.access.client = memberClient({ rows: [] })
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).standardRemaining).toBe(5)
  })

  it('清理过期预留 rpc 失败 → 503 AI 服务状态暂不可用', async () => {
    state.access.client = memberClient({ cleanupError: { message: 'db down' } })
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ error: 'AI 服务状态暂不可用' })
  })

  it('用量查询失败 → 503 AI 服务状态暂不可用', async () => {
    state.access.client = memberClient({ queryError: { message: 'db down' } })
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ error: 'AI 服务状态暂不可用' })
  })

  it('查询按当日 user_id 过滤、state 只取 pending/succeeded（口径与占额一致）', async () => {
    state.access.client = memberClient({ rows: [] })
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    expect(res.statusCode).toBe(200)
    expect(state.access.client.filters.eq).toEqual([
      ['user_id', 'u1'],
      ['used_on', '2026-03-10']
    ])
    expect(state.access.client.filters.in).toEqual([['state', ['pending', 'succeeded']]])
  })
})
