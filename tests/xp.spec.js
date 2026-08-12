// XP 与 22 大阿尔克那等级（M3 Task 4）：threshold(n)=50*n*(n-1) 累计 XP。
import { describe, it, expect } from 'vitest'
import { threshold, levelFromXp, levelProgress, levelCardId } from '../src/lib/xp.js'

describe('xp threshold', () => {
  it('threshold 单调递增', () => {
    for (let n = 2; n <= 22; n++) {
      expect(threshold(n)).toBeGreaterThan(threshold(n - 1))
    }
    expect(threshold(1)).toBe(0)
    expect(threshold(2)).toBe(100)
    expect(threshold(5)).toBe(1000)
    expect(threshold(10)).toBe(4500)
    expect(threshold(22)).toBe(23100)
  })
})

describe('levelFromXp', () => {
  it('0 XP → 1 级（愚人）', () => {
    expect(levelFromXp(0)).toBe(1)
  })
  it('XP 递增升级，跨多级', () => {
    expect(levelFromXp(99)).toBe(1)
    expect(levelFromXp(100)).toBe(2)
    expect(levelFromXp(999)).toBe(4)
    expect(levelFromXp(1000)).toBe(5)
  })
  it('封顶 22 级，不因超大 XP 越界', () => {
    expect(levelFromXp(10_000_000)).toBe(22)
  })
})

describe('levelProgress', () => {
  it('返回当前级、本级进度与占比', () => {
    const p = levelProgress(100) // 恰好升到 2 级，本级刚起步
    expect(p.level).toBe(2)
    expect(p.into).toBe(0)
    expect(p.span).toBe(threshold(3) - threshold(2)) // 300-100=200
    expect(p.pct).toBe(0)
  })
  it('满级时 pct=1', () => {
    const p = levelProgress(threshold(22))
    expect(p.level).toBe(22)
    expect(p.pct).toBe(1)
  })
})

describe('levelCardId', () => {
  it('n 级对应 major-(n-1)', () => {
    expect(levelCardId(1)).toBe('major-00')
    expect(levelCardId(22)).toBe('major-21')
  })
})
