// 分享卡片（M5 Task 2）：纯布局与截断函数。
import { describe, it, expect } from 'vitest'
import { truncate, buildShareLayout, SHARE_W } from '../src/lib/share-card.js'

const spread = { positions: [{ key: 'past', label: '过去' }, { key: 'present', label: '现在' }] }
const reading = {
  question: '我该如何准备这次机会',
  cards: [{ cardId: 'major-00', positionKey: 'past', reversed: false }, { cardId: 'major-01', positionKey: 'present', reversed: true }]
}

describe('share-card', () => {
  it('truncate 超长省略', () => {
    expect(truncate('abcdef', 4)).toBe('abc…')
    expect(truncate('abc', 5)).toBe('abc')
  })

  it('buildShareLayout 映射位置并居中', () => {
    const l = buildShareLayout(reading, spread, { includeQuestion: true })
    expect(l.positions).toHaveLength(2)
    expect(l.positions[0].label).toBe('过去')
    expect(l.positions[1].label).toBe('现在')
    expect(l.positions[1].reversed).toBe(true)
    // 居中：x + w/2 ≈ 画布中心
    expect(Math.abs(l.positions[0].x + l.positions[0].w / 2 - SHARE_W / 2)).toBeLessThan(2)
    expect(l.question).toContain('我该如何准备')
  })

  it('includeQuestion=false 时不带问题', () => {
    const l = buildShareLayout(reading, spread, { includeQuestion: false })
    expect(l.question).toBe('')
  })
})
