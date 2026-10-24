// 闪卡间隔重复（SM-2 精简版）：三档评分驱动间隔递增；不认识重置。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { newCard, review, dueCards } from '../src/lib/spaced-repetition.js'

const DAY = 24 * 3600 * 1000

describe('spaced-repetition', () => {
  afterEach(() => vi.useRealTimers())

  it('新卡默认状态：ease 2.5、interval 0、reps 0、马上到期', () => {
    const c = newCard()
    expect(c.ease).toBe(2.5)
    expect(c.interval).toBe(0)
    expect(c.reps).toBe(0)
    expect(c.due).toBeLessThanOrEqual(Date.now())
  })

  it('不认识：归零重来，10 分钟后重看', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-25T12:00:00'))
    const now = Date.now()
    const c = { ...newCard(), interval: 5, reps: 3, due: now - 1000 }
    const next = review(c, 'again')
    expect(next.reps).toBe(0)
    expect(next.interval).toBe(0)
    expect(next.due).toBeGreaterThan(now)
    expect(next.due - now).toBeLessThanOrEqual(10 * 60 * 1000)
  })

  it('模糊：间隔按 1.5 倍增长，从 0 起跳到 1 天', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-25T12:00:00'))
    const now = Date.now()
    let c = newCard()
    c = review(c, 'hard')
    expect(c.interval).toBe(1)
    expect(c.due - now).toBeGreaterThanOrEqual(1 * DAY - 1000)
    // 已有间隔时按 1.5 倍
    c = { ...c, interval: 4, due: now }
    const r = review(c, 'hard')
    expect(r.interval).toBe(6) // max(1, floor(4*1.5))
  })

  it('认识：间隔递增，0 → 1 → 乘 ease', () => {
    const now = Date.now()
    let c = { ...newCard(), due: now }
    c = review(c, 'good') // interval 0 → 1
    expect(c.interval).toBe(1)
    expect(c.reps).toBe(1)
    expect(c.due - now).toBeGreaterThanOrEqual(1 * DAY - 1000)

    c = review(c, 'good') // interval * ease = 1 * 2.5 = 2.5
    expect(c.interval).toBe(2.5)
    expect(c.due - now).toBeGreaterThanOrEqual(2.5 * DAY - 1000)
  })

  it('未知评分落到「认识」档（good 分支兜底），不误走 again/hard', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-25T12:00:00'))
    const now = Date.now()
    const c = { ...newCard(), interval: 4, reps: 3, ease: 2.5 }
    const r = review(c, 'ez') // 非三档的脏评分
    expect(r.interval).toBe(10) // interval * ease（hard 会是 6，again 会是 0）
    expect(r.reps).toBe(4)
    expect(r.due - now).toBeGreaterThanOrEqual(10 * DAY - 1000)
    const fresh = review(newCard(), undefined)
    expect(fresh.interval).toBe(1) // 0 → 1 起跳同样生效
    expect(fresh.reps).toBe(1)
  })

  it('dueCards 只返回已到期（due ≤ now）的卡', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-25T12:00:00'))
    const now = Date.now()
    const cards = [
      { id: 'a', due: now - 1000 },
      { id: 'b', due: now + DAY }, // 未到期
      { id: 'c', due: now }
    ]
    expect(dueCards(cards).map((c) => c.id).sort()).toEqual(['a', 'c'])
  })

  it('dueCards 空输入返回空，且第二参数自定义 now 生效', () => {
    const t0 = Date.parse('2026-07-25T12:00:00')
    expect(dueCards([], t0)).toEqual([])
    const cards = [{ id: 'a', due: t0 + DAY }]
    expect(dueCards(cards, t0)).toEqual([]) // 未到期
    expect(dueCards(cards, t0 + DAY).map((c) => c.id)).toEqual(['a']) // 到期边界含等于
  })
})
