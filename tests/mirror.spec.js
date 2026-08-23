// Mirror 聚合统计（M3 Task 5）：输入 readings 数组的纯函数，UI 只负责渲染。
import { describe, it, expect } from 'vitest'
import { topCards, suitDist, orientationDist, dailyFreq, domainDist } from '../src/lib/mirror.js'

function r(cards, domain, ts) {
  return { ts, domain, cards }
}

describe('mirror 聚合', () => {
  const readings = [
    r([{ cardId: 'major-00', reversed: false }, { cardId: 'wands-01', reversed: true }], 'love', Date.parse('2026-07-01T12:00:00')),
    r([{ cardId: 'major-00', reversed: false }, { cardId: 'cups-01', reversed: false }], 'career', Date.parse('2026-07-02T12:00:00')),
    r([{ cardId: 'major-00', reversed: true }, { cardId: 'swords-01', reversed: false }], 'love', Date.parse('2026-07-03T12:00:00')),
    r([{ cardId: 'pentacles-01', reversed: false }], null, Date.parse('2026-07-04T12:00:00'))
  ]

  it('topCards：最常出现的牌 Top N 按次数降序', () => {
    const top = topCards(readings, 3)
    expect(top[0].cardId).toBe('major-00')
    expect(top[0].count).toBe(3)
    expect(top.length).toBe(3)
  })

  it('suitDist：四花色 + 大牌计数', () => {
    const d = suitDist(readings)
    expect(d.major).toBe(3)
    expect(d.wands).toBe(1)
    expect(d.cups).toBe(1)
    expect(d.swords).toBe(1)
    expect(d.pentacles).toBe(1)
  })

  it('orientationDist：正逆位比例', () => {
    const o = orientationDist(readings)
    expect(o.upright).toBe(5)
    expect(o.reversed).toBe(2)
  })

  it('domainDist：领域分布，null 计入综合', () => {
    const d = domainDist(readings)
    expect(d.love).toBe(2)
    expect(d.career).toBe(1)
    expect(d.general).toBe(1) // null 那条
  })

  it('dailyFreq：返回近 N 天每日次数（含 0）', () => {
    const today = new Date('2026-07-04T12:00:00')
    const freq = dailyFreq(readings, 4, today)
    expect(freq).toHaveLength(4)
    expect(freq[freq.length - 1].count).toBe(1) // 今天那条
    const total = freq.reduce((s, f) => s + f.count, 0)
    expect(total).toBe(4)
  })

  it('dailyFreq：凌晨 4-8 点窗口不双重偏移（修复回归，旧代码末位会记到昨天）', () => {
    const today = new Date('2026-08-23T06:00:00')
    const todayReadings = [r([{ cardId: 'major-00', reversed: false }], null, Date.parse('2026-08-23T05:30:00'))]
    const freq = dailyFreq(todayReadings, 3, today)
    expect(freq[freq.length - 1].key).toBe('2026-08-23')
    expect(freq[freq.length - 1].count).toBe(1)
    expect(freq[freq.length - 2].key).toBe('2026-08-22')
    expect(freq[freq.length - 2].count).toBe(0)
  })
})
