// /api/admin/stats handler：五路并行取数 + 纯聚合组装的出口契约——结构齐全
//（totals/series 14 天/cost30 30 天/features/members/invites）、成员按加入时间倒序、
// 今日口径只计 pending+succeeded、邮箱未知回退空串、任一查询失败 503。
// 聚合纯函数本身的边界见 admin-stats.spec；requireOwner 门禁见 api-owner-gate.spec。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const state = vi.hoisted(() => ({ owner: null }))

vi.mock('../api/_lib/owner.js', () => ({
  requireOwner: vi.fn(async () => state.owner)
}))

// 各表链式查询统一为 thenable：select/eq/gte/order/limit 任意组合最终 await 出 result
function chain(result) {
  const q = {}
  for (const method of ['select', 'eq', 'gte', 'order', 'limit']) q[method] = vi.fn(() => q)
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return q
}

function statsClient({ users, members, invites, usage, events, failTable = null } = {}) {
  const err = { message: 'db down' }
  return {
    auth: { admin: { listUsers: vi.fn(async () => ({ data: { users }, error: null })) } },
    from: vi.fn((table) => {
      const tableData = { beta_members: members, beta_invite_codes: invites, ai_usage_events: usage, app_events: events }[table]
      return chain(failTable === table ? { data: null, error: err } : { data: tableData, error: null })
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

const reqOf = (method) => ({ method, headers: { authorization: 'Bearer tok' } })

async function freshHandler() {
  vi.resetModules()
  return (await import('../api/admin/stats.js')).default
}

// 固定时间：上海 2026-03-10 正午（UTC 04:00）
const NOW = new Date('2026-03-10T04:00:00Z')

function fixtures() {
  return {
    users: [
      { id: 'u1', email: 'a@x.com' },
      { id: 'u2', email: 'b@x.com' },
      { id: 'u3', email: 'ghost@x.com' } // 有账号未入成员
    ],
    members: [
      { user_id: 'u1', invite_code_hash: 'h1', created_at: '2026-02-01T00:00:00Z' },
      { user_id: 'u2', invite_code_hash: 'h2', created_at: '2026-03-01T00:00:00Z' },
      { user_id: 'uX', invite_code_hash: 'h3', created_at: '2026-03-05T00:00:00Z' } // 账号已删，邮箱查无
    ],
    invites: [
      { code_hash: 'abcdef1234567890', redeemed_by: 'u1', redeemed_at: '2026-02-01T00:00:00Z', created_at: '2026-01-25T00:00:00Z', expires_at: '2026-02-08T00:00:00Z' },
      { code_hash: 'bbbbb2222', redeemed_by: null, redeemed_at: null, created_at: '2026-03-01T00:00:00Z', expires_at: new Date(NOW.getTime() + 86_400_000).toISOString() },
      { code_hash: 'ccccc3333', redeemed_by: null, redeemed_at: null, created_at: '2026-03-02T00:00:00Z', expires_at: new Date(NOW.getTime() - 86_400_000).toISOString() },
      { code_hash: 'ddddd4444', redeemed_by: null, redeemed_at: null, created_at: '2026-03-03T00:00:00Z', expires_at: new Date(NOW.getTime() + 3650 * 86_400_000).toISOString() }
    ],
    usage: [
      { user_id: 'u1', mode: 'standard', state: 'succeeded', used_on: '2026-03-10', actual_cost_micro_yuan: 1500, reserved_cost_micro_yuan: 2000 },
      { user_id: 'u1', mode: 'deep', state: 'pending', used_on: '2026-03-10', actual_cost_micro_yuan: null, reserved_cost_micro_yuan: 9000 },
      { user_id: 'u2', mode: 'standard', state: 'failed', used_on: '2026-03-10', actual_cost_micro_yuan: 100, reserved_cost_micro_yuan: 2000 },
      { user_id: 'u2', mode: 'deep', state: 'succeeded', used_on: '2026-03-10', actual_cost_micro_yuan: 20000, reserved_cost_micro_yuan: 21000 },
      { user_id: 'u1', mode: 'standard', state: 'succeeded', used_on: '2026-03-09', actual_cost_micro_yuan: 1000, reserved_cost_micro_yuan: 1200 }
    ],
    events: [
      { user_id: 'u1', name: 'reading_complete', created_at: '2026-03-10T01:00:00Z' },
      { user_id: 'u2', name: 'page_view', created_at: '2026-03-10T02:00:00Z' }, // 只进日活不进功能榜
      { user_id: 'u1', name: 'daily_draw', created_at: '2026-03-09T01:00:00Z' }
    ]
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  state.owner = { user: { id: 'owner' }, client: statsClient(fixtures()) }
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
})

describe('/api/admin/stats handler', () => {
  it('POST → 405 仅支持 GET', async () => {
    const res = mockRes()
    await (await freshHandler())(reqOf('POST'), res)
    expect(res.statusCode).toBe(405)
    expect(JSON.parse(res.body)).toEqual({ error: '仅支持 GET' })
  })

  it('非站长 403 原样透传，不触库', async () => {
    state.owner = { status: 403, error: '仅站长可访问' }
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toEqual({ error: '仅站长可访问' })
  })

  it('任一表查询失败 → 503 看板服务暂不可用', async () => {
    for (const table of ['beta_members', 'beta_invite_codes', 'ai_usage_events', 'app_events']) {
      state.owner = { user: { id: 'owner' }, client: statsClient({ ...fixtures(), failTable: table }) }
      const res = mockRes()
      await (await freshHandler())(reqOf('GET'), res)
      expect(res.statusCode, table).toBe(503)
      expect(JSON.parse(res.body)).toEqual({ error: '看板服务暂不可用' })
    }
  })

  it('全量看板：totals/series/cost30/members/invites 结构与口径', async () => {
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.today).toBe('2026-03-10')

    // totals：账号 3、成员 3、今日调用 3（普 1 + 深 2，failed 不计）、今日日活 2
    expect(body.totals.accounts).toBe(3)
    expect(body.totals.members).toBe(3)
    expect(body.totals.aiCallsToday).toBe(3)
    expect(body.totals.aiCallsTodayStandard).toBe(1)
    expect(body.totals.aiCallsTodayDeep).toBe(2)
    expect(body.totals.aiUsersToday).toBe(2)
    expect(body.totals.dauToday).toBe(2)
    // 今日成本只算成功调用：1500 + 20000 = 0.0215 元；30 天总成本多含昨日 1000
    expect(body.totals.costTodayCny).toBe(0.0215)
    expect(body.totals.cost30dCny).toBe(0.0225)
    expect(body.totals.invites).toEqual({ total: 4, redeemed: 1, available: 2, expired: 1 })

    // 14 天序列：末日是今天，且今日各项落位
    expect(body.series).toHaveLength(14)
    const today = body.series[13]
    expect(today.day).toBe('2026-03-10')
    expect(today.aiCalls).toBe(3)
    expect(today.standard).toBe(1)
    expect(today.deep).toBe(2)
    expect(today.dau).toBe(2)
    expect(body.series[12].day).toBe('2026-03-09')
    expect(body.series[12].aiCalls).toBe(1)

    // 30 天成本序列
    expect(body.cost30).toHaveLength(30)
    expect(body.cost30[29].day).toBe('2026-03-10')
    expect(body.cost30[29].costCny).toBe(0.0215)

    // 功能使用榜：page_view 不入榜，按次数降序
    expect(body.features).toEqual([
      { name: 'reading_complete', count: 1 },
      { name: 'daily_draw', count: 1 }
    ])

    // 成员按加入时间倒序；今日普/深只计 pending+succeeded；累计口径同
    const byEmail = Object.fromEntries(body.members.map((m) => [m.email, m]))
    expect(body.members.map((m) => m.joinedAt)).toEqual([
      '2026-03-05T00:00:00Z',
      '2026-03-01T00:00:00Z',
      '2026-02-01T00:00:00Z'
    ])
    expect(byEmail['a@x.com'].todayStandard).toBe(1)
    expect(byEmail['a@x.com'].todayDeep).toBe(1) // pending 也占今日次数
    expect(byEmail['a@x.com'].totalCalls).toBe(3)
    expect(byEmail['a@x.com'].costCny).toBe(0.0025)
    expect(byEmail['b@x.com'].todayStandard).toBe(0) // failed 不计
    expect(byEmail['b@x.com'].todayDeep).toBe(1)
    expect(byEmail['b@x.com'].costCny).toBe(0.02)
    expect(byEmail[''].joinedAt).toBe('2026-03-05T00:00:00Z') // 账号已删的成员邮箱回退空串

    // 邀请码：哈希只露前 8 位，长期有效标志
    const longTerm = body.invites.find((i) => i.longTerm)
    expect(longTerm.status).toBe('available')
    expect(longTerm.tail).toBe('ddddd444') // hash 前 8 位
    for (const invite of body.invites) {
      expect(invite.tail.length).toBeLessThanOrEqual(8)
      expect(JSON.stringify(invite)).not.toMatch(/[a-f0-9]{9,}/) // 完整哈希不出服务端
    }
  })
})
