// 站长数据看板（2026-09-26）：纯聚合函数守卫——看板只读现有表做统计，
// 不新增收集口径；成本单位 micro_yuan（百万分之一元）在此统一换算成元。
import { describe, it, expect } from 'vitest'
import {
  dayKeyOf,
  buildDaySeries,
  aggregateAiUsage,
  aggregateActivity,
  costPerDay,
  summarizeInvites
} from '../api/_lib/stats.js'

describe('stats：dayKeyOf / buildDaySeries', () => {
  it('ISO 时间戳按上海时区取日键', () => {
    // UTC 2026-09-26T17:00Z = 上海 09-27 凌晨 1 点
    expect(dayKeyOf('2026-09-26T17:00:00Z')).toBe('2026-09-27')
    expect(dayKeyOf('2026-09-26T12:00:00Z')).toBe('2026-09-26')
  })

  it('非法时间戳返回空串（不炸，脏行落不进任何一天）', () => {
    expect(dayKeyOf('not-a-date')).toBe('')
    expect(dayKeyOf('')).toBe('')
    expect(dayKeyOf(undefined)).toBe('')
  })

  it('buildDaySeries 生成最近 N 天连续序列（含今天）', () => {
    const series = buildDaySeries(3, '2026-09-27')
    expect(series.map((d) => d.day)).toEqual(['2026-09-25', '2026-09-26', '2026-09-27'])
  })
})

describe('stats：aggregateAiUsage', () => {
  const rows = [
    { user_id: 'u1', mode: 'standard', state: 'succeeded', used_on: '2026-09-27', actual_cost_micro_yuan: 1500, reserved_cost_micro_yuan: 2000 },
    { user_id: 'u1', mode: 'standard', state: 'failed', used_on: '2026-09-27', actual_cost_micro_yuan: 100, reserved_cost_micro_yuan: 2000 },
    { user_id: 'u2', mode: 'deep', state: 'pending', used_on: '2026-09-27', actual_cost_micro_yuan: null, reserved_cost_micro_yuan: 9000 },
    { user_id: 'u1', mode: 'deep', state: 'succeeded', used_on: '2026-09-26', actual_cost_micro_yuan: 20000, reserved_cost_micro_yuan: 21000 }
  ]

  it('调用数只算 pending+succeeded，failed 不计（与额度口径一致）', () => {
    const agg = aggregateAiUsage(rows, '2026-09-27', ['2026-09-26', '2026-09-27'])
    expect(agg.callsToday).toBe(2)
    expect(agg.perDay['2026-09-27']).toBe(2)
    expect(agg.perDay['2026-09-26']).toBe(1)
  })

  it('成本只算成功调用（actual 优先，缺 actual 回落 reserved），换算成元', () => {
    const agg = aggregateAiUsage(rows, '2026-09-27', ['2026-09-26', '2026-09-27'])
    // (1500 + 20000) / 1e6 = 0.0215；失败与 pending 不计成本
    expect(agg.costCnyTotal).toBeCloseTo(0.0215, 6)
  })

  it('按人汇总：u1 两个成功调用 + 成本，u2 一个 pending', () => {
    const agg = aggregateAiUsage(rows, '2026-09-27', ['2026-09-26', '2026-09-27'])
    const byId = new Map(agg.perUser.map((u) => [u.user_id, u]))
    expect(byId.get('u1')).toMatchObject({ standard: 1, deep: 1, total: 2 })
    expect(byId.get('u2')).toMatchObject({ standard: 0, deep: 1, total: 1 })
  })

  it('今日活跃 AI 用户数 = 今天有调用的去重人数', () => {
    const agg = aggregateAiUsage(rows, '2026-09-27', ['2026-09-26', '2026-09-27'])
    expect(agg.usersToday).toBe(2)
  })

  it('普/深分列：按日与今日调用都拆开（failed/pending 仍计入次数）', () => {
    const agg = aggregateAiUsage(rows, '2026-09-27', ['2026-09-26', '2026-09-27'])
    expect(agg.perDayStandard['2026-09-27']).toBe(1)
    expect(agg.perDayDeep['2026-09-27']).toBe(1)
    expect(agg.perDayDeep['2026-09-26']).toBe(1)
    expect(agg.perDayStandard['2026-09-26']).toBe(0)
    expect(agg.callsTodayStandard).toBe(1)
    expect(agg.callsTodayDeep).toBe(1)
  })
})

describe('stats：costPerDay（成本趋势）', () => {
  const rows = [
    { state: 'succeeded', used_on: '2026-09-26', actual_cost_micro_yuan: 20000, reserved_cost_micro_yuan: 21000 },
    { state: 'succeeded', used_on: '2026-09-27', actual_cost_micro_yuan: null, reserved_cost_micro_yuan: 1500 },
    { state: 'failed', used_on: '2026-09-27', actual_cost_micro_yuan: 500, reserved_cost_micro_yuan: 900 }
  ]

  it('按天换算成元，failed 不计，无调用日为 0；今日成本取当日键', () => {
    const cost = costPerDay(rows, ['2026-09-26', '2026-09-27', '2026-09-28'])
    expect(cost.perDayCny['2026-09-26']).toBeCloseTo(0.02, 6)
    expect(cost.perDayCny['2026-09-27']).toBeCloseTo(0.0015, 6)
    expect(cost.perDayCny['2026-09-28']).toBe(0)
  })
})

describe('stats：aggregateActivity（page_view 日活与功能使用）', () => {
  // 时间戳刻意跨 UTC 日期：17:30Z 已是上海次日，验证日键走上海时区
  const rows = [
    { user_id: 'u1', name: 'page_view', created_at: '2026-09-25T17:30:00Z' },
    { user_id: 'u1', name: 'page_view', created_at: '2026-09-26T03:30:00Z' },
    { user_id: 'u2', name: 'page_view', created_at: '2026-09-26T05:20:00Z' },
    { user_id: 'u1', name: 'reading_complete', created_at: '2026-09-26T07:00:00Z' },
    { user_id: 'u1', name: 'page_view', created_at: '2026-09-25T01:00:00Z' }
  ]

  it('日活按上海日键去重人数', () => {
    const agg = aggregateActivity(rows, '2026-09-26', ['2026-09-25', '2026-09-26'])
    expect(agg.perDay['2026-09-26']).toBe(2)
    expect(agg.perDay['2026-09-25']).toBe(1)
    expect(agg.dauToday).toBe(2)
  })

  it('功能使用计数（page_view 只算日活不进功能榜）', () => {
    const agg = aggregateActivity(rows, '2026-09-26', ['2026-09-25', '2026-09-26'])
    expect(agg.features).toEqual([{ name: 'reading_complete', count: 1 }])
  })
})

describe('stats：summarizeInvites', () => {
  const emailById = new Map([['u1', 'owner@test.com']])
  const invites = [
    { code_hash: 'aaa111222333', redeemed_by: 'u1', redeemed_at: '2026-09-26T11:00:00Z', created_at: '2026-09-20T00:00:00Z', expires_at: '2099-01-01T00:00:00Z' },
    { code_hash: 'bbb444555666', redeemed_by: null, redeemed_at: null, created_at: '2026-09-21T00:00:00Z', expires_at: '2099-01-01T00:00:00Z' },
    { code_hash: 'ccc777888999', redeemed_by: null, redeemed_at: null, created_at: '2026-08-01T00:00:00Z', expires_at: '2026-08-15T00:00:00Z' },
    { code_hash: 'ddd000111222', redeemed_by: null, redeemed_at: null, created_at: '2026-09-12T00:00:00Z', expires_at: '2026-09-27T00:00:00Z' }
  ]

  it('状态三分类：已兑换/未用/过期；兑换人映射邮箱；哈希只露前 8 位', () => {
    const list = summarizeInvites(invites, emailById, '2026-09-26')
    expect(list.map((r) => r.status)).toEqual(['redeemed', 'available', 'expired', 'available'])
    expect(list[0].redeemedEmail).toBe('owner@test.com')
    expect(list[0].tail).toBe('aaa11122')
    expect(list[1].redeemedEmail).toBe('')
    expect(list[2].redeemedEmail).toBe('')
  })

  it('长期有效标志：有效期跨度 ≥3 年为 true（「长期」=3650 天），短码为 false', () => {
    const list = summarizeInvites(invites, emailById, '2026-09-26')
    expect(list.map((r) => r.longTerm)).toEqual([true, true, false, false])
  })

  it('过期判定是严格大于：expires_at 恰好等于 now 即已过期，前 1 秒仍可用', () => {
    const row = { code_hash: 'eee111222333', redeemed_by: null, created_at: '2026-09-20T00:00:00Z', expires_at: '2026-09-26T00:00:00Z' }
    expect(summarizeInvites([row], emailById, '2026-09-26T00:00:00Z')[0].status).toBe('expired')
    expect(summarizeInvites([row], emailById, '2026-09-25T23:59:59Z')[0].status).toBe('available')
  })

  it('now 缺省按 0（epoch）兜底判定：调用方漏传不炸，判定基准退回 1970 年', () => {
    const rows = [
      // 1970 年后的到期时间相对 epoch 都算「未过期」——漏传 now 只会误判宽松，不会崩
      { code_hash: 'fff000111222', redeemed_by: null, created_at: '2026-01-01T00:00:00Z', expires_at: '2026-02-01T00:00:00Z' },
      { code_hash: 'aaa000111222', redeemed_by: null, created_at: '1960-01-01T00:00:00Z', expires_at: '1969-12-31T23:59:59Z' }
    ]
    const list = summarizeInvites(rows, new Map(), undefined)
    expect(list.map((r) => r.status)).toEqual(['available', 'expired'])
    // longTerm 只看 created→expires 跨度，与 now 无关：十年跨度的过期码依旧标长期
    expect(list.map((r) => r.longTerm)).toEqual([false, true])
  })
})

describe('stats：空与脏输入兜底', () => {
  const dayKeys = ['2026-09-26', '2026-09-27']

  it('null/空数组不炸：四个聚合都返回零值空结构', () => {
    for (const rows of [null, []]) {
      const agg = aggregateAiUsage(rows, '2026-09-27', dayKeys)
      expect(agg.callsToday).toBe(0)
      expect(agg.callsTodayStandard).toBe(0)
      expect(agg.callsTodayDeep).toBe(0)
      expect(agg.usersToday).toBe(0)
      expect(agg.perDay).toEqual({ '2026-09-26': 0, '2026-09-27': 0 })
      expect(agg.perDayStandard).toEqual({ '2026-09-26': 0, '2026-09-27': 0 })
      expect(agg.perDayDeep).toEqual({ '2026-09-26': 0, '2026-09-27': 0 })
      expect(agg.perUser).toEqual([])
      expect(agg.costCnyTotal).toBe(0)

      expect(costPerDay(rows, dayKeys).perDayCny).toEqual({ '2026-09-26': 0, '2026-09-27': 0 })

      const act = aggregateActivity(rows, '2026-09-27', dayKeys)
      expect(act.perDay).toEqual({ '2026-09-26': 0, '2026-09-27': 0 })
      expect(act.dauToday).toBe(0)
      expect(act.features).toEqual([])
    }
    expect(summarizeInvites(null, new Map(), '2026-09-27')).toEqual([])
    expect(summarizeInvites([], new Map(), '2026-09-27')).toEqual([])
  })

  it('成功调用成本为 NaN/负数/0 时贡献 0，调用次数照常统计', () => {
    const rows = [
      { user_id: 'u1', mode: 'standard', state: 'succeeded', used_on: '2026-09-27', actual_cost_micro_yuan: NaN },
      { user_id: 'u2', mode: 'standard', state: 'succeeded', used_on: '2026-09-27', actual_cost_micro_yuan: -500 },
      { user_id: 'u3', mode: 'deep', state: 'succeeded', used_on: '2026-09-27', actual_cost_micro_yuan: 0 },
      { user_id: 'u4', mode: 'standard', state: 'succeeded', used_on: '2026-09-27', actual_cost_micro_yuan: null, reserved_cost_micro_yuan: null }
    ]
    const agg = aggregateAiUsage(rows, '2026-09-27', dayKeys)
    expect(agg.callsToday).toBe(4)
    expect(agg.costCnyTotal).toBe(0)
    expect(agg.perUser.every((u) => u.costCny === 0)).toBe(true)
    // costPerDay 同口径：脏成本行不计，正常行不受影响
    const cost = costPerDay([...rows, { state: 'succeeded', used_on: '2026-09-26', actual_cost_micro_yuan: 1000 }], dayKeys)
    expect(cost.perDayCny['2026-09-26']).toBeCloseTo(0.001, 6)
    expect(cost.perDayCny['2026-09-27']).toBe(0)
  })

  it('used_on 在 dayKeys 窗口外：不进 perDay，但 perUser/总成本照常计入（看板按 30 天查询窗口取数）', () => {
    const rows = [
      { user_id: 'u1', mode: 'standard', state: 'succeeded', used_on: '2026-09-20', actual_cost_micro_yuan: 3000 },
      { user_id: 'u1', mode: 'deep', state: 'pending', used_on: '2026-09-27', reserved_cost_micro_yuan: 100 }
    ]
    const agg = aggregateAiUsage(rows, '2026-09-27', dayKeys)
    expect(agg.perDay).toEqual({ '2026-09-26': 0, '2026-09-27': 1 })
    expect(agg.perDay['2026-09-20']).toBeUndefined()
    const u1 = agg.perUser.find((u) => u.user_id === 'u1')
    expect(u1).toMatchObject({ standard: 1, deep: 1, total: 2 })
    expect(u1.costCny).toBeCloseTo(0.003, 6)
    expect(agg.costCnyTotal).toBeCloseTo(0.003, 6)
    expect(agg.callsToday).toBe(1)
  })

  it('summarizeInvites 脏行：缺 code_hash 尾巴为空串，兑换人不在邮箱映射为空邮箱', () => {
    const list = summarizeInvites([
      { redeemed_by: 'u1', created_at: '2026-09-20T00:00:00Z', expires_at: '2099-01-01T00:00:00Z' },
      { code_hash: 'xyz', redeemed_by: 'ghost', created_at: '2026-09-20T00:00:00Z', expires_at: '2099-01-01T00:00:00Z' }
    ], new Map(), '2026-09-27')
    expect(list[0].tail).toBe('')
    expect(list[0].redeemedEmail).toBe('')
    expect(list[1].status).toBe('redeemed')
    expect(list[1].tail).toBe('xyz')
    expect(list[1].redeemedEmail).toBe('')
  })
})
