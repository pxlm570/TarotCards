// 打卡日以凌晨 4 点为界：dayKey =（now - 4 小时）的本地日期。
// 睡前 0-2 点使用场景：23:59 与次日 00:30 视为同一个「夜晚」。
import { describe, it, expect } from 'vitest'
import { currentDayKey } from '../src/lib/day-key.js'

describe('day-key：凌晨 4 点分界', () => {
  it('04:00 整属于当天', () => {
    expect(currentDayKey(new Date('2026-07-25T04:00:00'))).toBe('2026-07-25')
  })

  it('03:59 属于前一天', () => {
    expect(currentDayKey(new Date('2026-07-25T03:59:59'))).toBe('2026-07-24')
  })

  it('凌晨 00:30 属于前一天（睡前场景）', () => {
    expect(currentDayKey(new Date('2026-07-25T00:30:00'))).toBe('2026-07-24')
  })

  it('白天与傍晚归当天', () => {
    expect(currentDayKey(new Date('2026-07-25T12:00:00'))).toBe('2026-07-25')
    expect(currentDayKey(new Date('2026-07-25T23:59:00'))).toBe('2026-07-25')
  })

  it('跨月边界正确（3 月 1 日凌晨 → 2 月最后一天）', () => {
    expect(currentDayKey(new Date('2026-03-01T03:00:00'))).toBe('2026-02-28')
    expect(currentDayKey(new Date('2026-03-01T04:00:00'))).toBe('2026-03-01')
  })

  it('默认取当前时间', () => {
    expect(typeof currentDayKey()).toBe('string')
    expect(currentDayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
