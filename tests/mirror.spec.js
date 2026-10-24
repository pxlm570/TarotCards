// Mirror 聚合统计（M3 Task 5）：输入 readings 数组的纯函数，UI 只负责渲染。
import { describe, it, expect } from 'vitest'
import { topCards, suitDist, orientationDist, dailyFreq, domainDist, recentCardCount } from '../src/lib/mirror.js'

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

  it('dailyFreq：窗口外记录不计入，键从旧到新排列且末位是今天', () => {
    const old = [r([{ cardId: 'major-00', reversed: false }], null, Date.parse('2026-01-01T12:00:00'))]
    const freq = dailyFreq(old, 3, new Date('2026-07-04T12:00:00'))
    expect(freq.map((f) => f.count)).toEqual([0, 0, 0])
    expect(freq.map((f) => f.key)).toEqual(['2026-07-02', '2026-07-03', '2026-07-04'])
  })

  it('topCards：并列次数保持首次出现顺序（稳定排序），空记录返回空数组', () => {
    const rs = [
      r([{ cardId: 'cups-02', reversed: false }], null, 1),
      r([{ cardId: 'wands-03', reversed: false }], null, 2)
    ]
    expect(topCards(rs)).toEqual([
      { cardId: 'cups-02', count: 1 },
      { cardId: 'wands-03', count: 1 }
    ])
    expect(topCards([])).toEqual([])
  })

  it('未知花色前缀不落入任何花色桶；未知领域字符串计入综合', () => {
    expect(suitDist([r([{ cardId: 'foo-01', reversed: false }], null, 1)])).toEqual({
      major: 0, wands: 0, cups: 0, swords: 0, pentacles: 0
    })
    expect(domainDist([r([], 'other', 1)])).toEqual({
      love: 0, career: 0, wealth: 0, study: 0, general: 1
    })
  })
})

// recentCardCount（每日一抽历史钩子 Task 10）：此前零覆盖的导出函数。与 dailyFreq 同用
// currentDayKey 凌晨 4 点分界 + setDate 口径（DST 时区下 ms 减法会偏一天，见 dailyFreq 回归用例）。
describe('recentCardCount：近 N 天某牌出现次数', () => {
  it('窗口内所有出现都计数：跨占卜多次、同一条占卜里正逆两张累计', () => {
    const readings = [
      r([{ cardId: 'major-00', reversed: false }, { cardId: 'cups-01', reversed: false }], 'love', Date.parse('2026-07-03T12:00:00')),
      r([{ cardId: 'major-00', reversed: true }, { cardId: 'major-00', reversed: false }], 'career', Date.parse('2026-07-04T12:00:00'))
    ]
    // 2 天窗口 = 7-03~7-04：major-00 共 3 次（含同局两张），cups-01 共 1 次
    expect(recentCardCount(readings, 'major-00', { days: 2, today: new Date('2026-07-04T12:00:00') })).toBe(3)
    expect(recentCardCount(readings, 'cups-01', { days: 2, today: new Date('2026-07-04T12:00:00') })).toBe(1)
  })

  it('窗口外不计入：起点前一天与未来记录都跳过', () => {
    const readings = [
      r([{ cardId: 'major-00', reversed: false }], null, Date.parse('2026-07-01T12:00:00')),
      r([{ cardId: 'major-00', reversed: false }], null, Date.parse('2026-07-05T12:00:00'))
    ]
    // 3 天窗口 = 7-02~7-04，两条都不在窗口内
    expect(recentCardCount(readings, 'major-00', { days: 3, today: new Date('2026-07-04T12:00:00') })).toBe(0)
  })

  it('默认 days=30：恰在窗口起点（含）当天计入，起点前一天不计', () => {
    const today = new Date('2026-07-30T12:00:00')
    const readings = [
      r([{ cardId: 'wands-01', reversed: false }], null, Date.parse('2026-07-01T12:00:00')),
      r([{ cardId: 'wands-01', reversed: false }], null, Date.parse('2026-06-30T12:00:00'))
    ]
    expect(recentCardCount(readings, 'wands-01', { today })).toBe(1)
  })

  it('凌晨 4 点分界与 dailyFreq 同口径：05:30 属今天、03:30 属昨天（days=1 不计昨天）', () => {
    const today = new Date('2026-08-23T06:00:00')
    const readings = [
      r([{ cardId: 'major-00', reversed: false }], null, Date.parse('2026-08-23T05:30:00')),
      r([{ cardId: 'major-00', reversed: false }], null, Date.parse('2026-08-23T03:30:00'))
    ]
    expect(recentCardCount(readings, 'major-00', { days: 1, today })).toBe(1)
  })

  it('空 readings 与目标牌未出现都返回 0', () => {
    expect(recentCardCount([], 'major-00')).toBe(0)
    const readings = [r([{ cardId: 'cups-01', reversed: false }], null, Date.parse('2026-07-04T12:00:00'))]
    expect(recentCardCount(readings, 'wands-01', { days: 7, today: new Date('2026-07-04T12:00:00') })).toBe(0)
  })
})
