// 连胜计算（M3 Task 3）：打卡日以凌晨 4 点为界（dayKey 已在 day-key.js 负责）。
// dates: 已打卡的 YYYY-MM-DD 数组；today: 当天 YYYY-MM-DD。
import { describe, it, expect } from 'vitest'
import { calcStreak, calcMaxStreak } from '../src/lib/streak.js'

describe('calcStreak', () => {
  it('连续 3 天，今日已打卡 → 3', () => {
    expect(calcStreak(['2026-07-23', '2026-07-24', '2026-07-25'], '2026-07-25')).toBe(3)
  })

  it('今日未打卡但昨日有 → 连胜暂存为昨日至今的连续天数（待打卡）', () => {
    expect(calcStreak(['2026-07-23', '2026-07-24'], '2026-07-25')).toBe(2)
  })

  it('断签（昨日缺）→ 0', () => {
    expect(calcStreak(['2026-07-23', '2026-07-25'], '2026-07-25')).toBe(1)
    expect(calcStreak(['2026-07-23'], '2026-07-25')).toBe(0)
  })

  it('空记录 → 0', () => {
    expect(calcStreak([], '2026-07-25')).toBe(0)
  })

  it('跨月连续正确', () => {
    expect(calcStreak(['2026-06-29', '2026-06-30', '2026-07-01'], '2026-07-01')).toBe(3)
  })
})

describe('calcMaxStreak', () => {
  it('历史最长连续天数', () => {
    expect(calcMaxStreak(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-10', '2026-07-11'])).toBe(3)
  })

  it('跨月连续计入', () => {
    expect(calcMaxStreak(['2026-06-30', '2026-07-01', '2026-07-02'])).toBe(3)
  })

  it('单天或空 → 1 或 0', () => {
    expect(calcMaxStreak(['2026-07-01'])).toBe(1)
    expect(calcMaxStreak([])).toBe(0)
  })
})
