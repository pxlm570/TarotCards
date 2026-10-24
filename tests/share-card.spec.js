// 分享卡片（M5 Task 2）：纯布局与截断函数。
import { describe, it, expect } from 'vitest'
import { truncate, buildShareLayout, SHARE_W, SHARE_H } from '../src/lib/share-card.js'

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

  it('truncate 假值早退返回空串', () => {
    expect(truncate('', 30)).toBe('')
    expect(truncate(null, 30)).toBe('')
    expect(truncate(undefined, 30)).toBe('')
    expect(truncate(0, 30)).toBe('')
  })

  it('问题 30 字上限：恰好 30 原样、31 字截为 29 字加省略号、短问题原样', () => {
    const q30 = '一二三四五六七八九十'.repeat(3)
    const l30 = buildShareLayout({ question: q30, cards: [reading.cards[0]] }, spread, { includeQuestion: true })
    expect(l30.question).toBe(q30) // 恰好 30 字不截断

    // 31 个不重复汉字：输出锁 29 原字 + …（旧 40 字上限会尾部裁切，故收紧为 30）
    const q31 = Array.from({ length: 31 }, (_, i) => String.fromCharCode(0x4e00 + i)).join('')
    const l31 = buildShareLayout({ question: q31, cards: [reading.cards[0]] }, spread, { includeQuestion: true })
    expect(l31.question).toBe(q31.slice(0, 29) + '…')
    expect(l31.question).toHaveLength(30)
    expect(l31.question).not.toContain(q31[30]) // 第 31 个原字符不得出现

    const lShort = buildShareLayout({ question: '今天运势如何', cards: [reading.cards[0]] }, spread, { includeQuestion: true })
    expect(lShort.question).toBe('今天运势如何')
  })

  it('未知 positionKey 与无 spread 时牌位标签为空串且不炸', () => {
    const r = { question: '', cards: [{ cardId: 'major-05', positionKey: 'no-such-key', reversed: false }] }
    expect(buildShareLayout(r, spread, {}).positions[0].label).toBe('')
    expect(() => buildShareLayout(r, null, {})).not.toThrow()
    expect(buildShareLayout(r, null, {}).positions[0].label).toBe('')
    expect(buildShareLayout(r, undefined, {}).positions[0].label).toBe('')
  })

  it('空 cards 时 positions 为空且 keywords 为空数组', () => {
    const l = buildShareLayout({ question: '', cards: [] }, spread, {})
    expect(l.positions).toHaveLength(0)
    expect(l.keywords).toEqual([])
  })

  it('多牌时卡高不超 400 上限、逐位递增且水平居中', () => {
    const cards = Array.from({ length: 5 }, (_, i) => ({ cardId: `major-0${i}`, positionKey: 'past', reversed: false }))
    const l = buildShareLayout({ question: '', cards }, spread, {})
    expect(l.keywords).toEqual(['星语塔罗'])
    for (const p of l.positions) {
      expect(p.h).toBeLessThanOrEqual(400)
      expect(Math.abs(p.x + p.w / 2 - SHARE_W / 2)).toBeLessThan(2)
    }
    for (let i = 1; i < l.positions.length; i++) {
      expect(l.positions[i].y).toBeGreaterThan(l.positions[i - 1].y)
    }
    // 单牌也被 Math.min 压到 400 上限（而非占满 720 高）
    const single = buildShareLayout({ question: '', cards: [cards[0]] }, spread, {})
    expect(single.positions[0].h).toBe(400)
  })
})

// 布局边界（2026-10-24 补薄弱分支）：问题区起点、卡框比例、省略参数的默认口径
describe('share-card：布局边界', () => {
  it('画布尺寸 1080×1350（4:5）', () => {
    expect(SHARE_W).toBe(1080)
    expect(SHARE_H).toBe(1350)
  })

  it('includeQuestion 决定牌面区起点：true 360 / false 300', () => {
    expect(buildShareLayout(reading, spread, { includeQuestion: true }).positions[0].y).toBe(360)
    expect(buildShareLayout(reading, spread, { includeQuestion: false }).positions[0].y).toBe(300)
  })

  it('includeQuestion=true 但问题为空/缺失：question 为空串', () => {
    expect(buildShareLayout({ cards: reading.cards }, spread, { includeQuestion: true }).question).toBe('')
    expect(buildShareLayout({ question: '', cards: reading.cards }, spread, { includeQuestion: true }).question).toBe('')
  })

  it('options 省略：includeQuestion 视为 falsy（无问题、牌区起点 300）', () => {
    const omitted = buildShareLayout(reading, spread)
    expect(omitted.question).toBe('')
    expect(omitted.positions[0].y).toBe(300)
    const empty = buildShareLayout(reading, spread, {})
    expect(empty.question).toBe('')
    expect(empty.positions[0].y).toBe(300)
  })

  it('单牌卡框比例贴合 300/527（真牌面 cover 裁剪的基准比例）', () => {
    const p = buildShareLayout({ question: '', cards: [reading.cards[0]] }, spread, {}).positions[0]
    expect(p.h).toBe(400)
    expect(p.w).toBeCloseTo(400 * (300 / 527), 6)
    expect(p.w / p.h).toBeCloseTo(300 / 527, 6)
  })
})
