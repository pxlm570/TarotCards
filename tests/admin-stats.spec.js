// 站长数据看板（2026-09-26）：纯聚合函数守卫——看板只读现有表做统计，
// 不新增收集口径；成本单位 micro_yuan（百万分之一元）在此统一换算成元。
import { describe, it, expect } from 'vitest'
import {
  dayKeyOf,
  buildDaySeries,
  aggregateAiUsage,
  aggregateActivity,
  summarizeInvites
} from '../api/_lib/stats.js'

describe('stats：dayKeyOf / buildDaySeries', () => {
  it('ISO 时间戳按上海时区取日键', () => {
    // UTC 2026-09-26T17:00Z = 上海 09-27 凌晨 1 点
    expect(dayKeyOf('2026-09-26T17:00:00Z')).toBe('2026-09-27')
    expect(dayKeyOf('2026-09-26T12:00:00Z')).toBe('2026-09-26')
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
    { code_hash: 'ccc777888999', redeemed_by: null, redeemed_at: null, created_at: '2026-08-01T00:00:00Z', expires_at: '2026-08-15T00:00:00Z' }
  ]

  it('状态三分类：已兑换/未用/过期；兑换人映射邮箱；哈希只露前 8 位', () => {
    const list = summarizeInvites(invites, emailById, '2026-09-26')
    expect(list.map((r) => r.status)).toEqual(['redeemed', 'available', 'expired'])
    expect(list[0].redeemedEmail).toBe('owner@test.com')
    expect(list[0].tail).toBe('aaa11122')
    expect(list[1].redeemedEmail).toBe('')
    expect(list[2].redeemedEmail).toBe('')
  })
})
