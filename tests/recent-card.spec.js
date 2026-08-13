// 每日一抽「历史钩子」（Task 10）：某 cardId 在近 30 天（dayKey 口径，含今天）的 readings 中出现次数。
import { describe, it, expect } from 'vitest'
import { recentCardCount } from '../src/lib/mirror.js'

const DAY = 24 * 3600 * 1000
const TODAY = new Date('2026-08-13T12:00:00')

function reading(daysAgo, cards) {
  return { ts: TODAY.getTime() - daysAgo * DAY, cards }
}

describe('recentCardCount', () => {
  it('今天与 29 天前（第 30 天）都在窗口内', () => {
    const rs = [reading(0, [{ cardId: 'major-00' }]), reading(29, [{ cardId: 'major-00' }])]
    expect(recentCardCount(rs, 'major-00', { today: TODAY })).toBe(2)
  })

  it('30 天前（第 31 天）不在窗口内（边界）', () => {
    const rs = [reading(30, [{ cardId: 'major-00' }]), reading(29, [{ cardId: 'major-00' }])]
    expect(recentCardCount(rs, 'major-00', { today: TODAY })).toBe(1)
  })

  it('只统计指定 cardId，跨牌不串', () => {
    const rs = [
      reading(1, [{ cardId: 'major-00' }, { cardId: 'wands-01' }]),
      reading(2, [{ cardId: 'major-01' }])
    ]
    expect(recentCardCount(rs, 'major-00', { today: TODAY })).toBe(1)
    expect(recentCardCount(rs, 'wands-01', { today: TODAY })).toBe(1)
    expect(recentCardCount(rs, 'major-01', { today: TODAY })).toBe(1)
  })

  it('逆位同样计入', () => {
    const rs = [reading(1, [{ cardId: 'major-00', reversed: true }])]
    expect(recentCardCount(rs, 'major-00', { today: TODAY })).toBe(1)
  })

  it('同一局多张同牌计入多次；窗口外的牌不影响', () => {
    const rs = [
      reading(5, [{ cardId: 'major-00' }, { cardId: 'major-00' }]),
      reading(31, [{ cardId: 'major-00' }])
    ]
    expect(recentCardCount(rs, 'major-00', { today: TODAY })).toBe(2)
  })
})
