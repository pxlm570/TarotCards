// api/_lib/shanghai-day：AI 额度与看板统计共用的上海自然日键。
// 防止 UTC 日界与上海日界混淆，以及 day/month 拆成两次调用时跨月不一致。
import { describe, it, expect } from 'vitest'
import { shanghaiDayKey, shanghaiDayAndMonthKeys } from '../api/_lib/shanghai-day.js'

describe('shanghaiDayKey', () => {
  it('上海仍在当日时，UTC 已跨日的时刻仍归上海当日', () => {
    // 2026-01-01 15:00Z = 上海 2026-01-01 23:00
    expect(shanghaiDayKey(new Date('2026-01-01T15:00:00Z'))).toBe('2026-01-01')
  })

  it('UTC 16:00 起已是上海次日', () => {
    // 2026-01-01 16:00Z = 上海 2026-01-02 00:00
    expect(shanghaiDayKey(new Date('2026-01-01T16:00:00Z'))).toBe('2026-01-02')
  })

  it('默认参数返回 YYYY-MM-DD', () => {
    expect(shanghaiDayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('shanghaiDayAndMonthKeys', () => {
  it('同一时刻的 day 与 month 口径一致（month 为当月 01）', () => {
    const { day, month } = shanghaiDayAndMonthKeys(new Date('2026-03-10T02:00:00Z')) // 上海 10:00
    expect(day).toBe('2026-03-10')
    expect(month).toBe('2026-03-01')
  })

  it('上海跨月零点：day 进新月，month 同步切到新月 01', () => {
    // 2026-01-31 16:00Z = 上海 2026-02-01 00:00
    const { day, month } = shanghaiDayAndMonthKeys(new Date('2026-01-31T16:00:00Z'))
    expect(day).toBe('2026-02-01')
    expect(month).toBe('2026-02-01')
  })

  it('跨月前一刻仍属旧月', () => {
    // 2026-01-31 15:59:59Z = 上海 2026-01-31 23:59:59
    const { day, month } = shanghaiDayAndMonthKeys(new Date('2026-01-31T15:59:59Z'))
    expect(day).toBe('2026-01-31')
    expect(month).toBe('2026-01-01')
  })
})
