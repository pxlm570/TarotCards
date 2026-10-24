// 牌面收集统计（v1.5 Task 8）：从 journal readings 聚合各牌出现次数与正逆分布。
// 收藏馆的「已点亮 X/78」与角标数据源；纯函数、零新增存储。
import { describe, it, expect } from 'vitest'
import { collectionStats, collectedCount } from '../src/lib/collection-stats.js'
import cards from '../src/data/cards.json'

const r = (cards) => ({ ts: 1, cards })

describe('collectionStats', () => {
  it('空记录 / 空数组返回空统计，collectedCount 为 0', () => {
    expect(collectionStats([])).toEqual({})
    expect(collectionStats(null)).toEqual({})
    expect(collectedCount({}, cards)).toBe(0)
  })

  it('聚合计数与正逆分布', () => {
    const stats = collectionStats([
      r([{ cardId: 'major-00' }, { cardId: 'major-00', reversed: true }, { cardId: 'wands-01', reversed: true }]),
      r([{ cardId: 'major-00', reversed: false }])
    ])
    expect(stats['major-00']).toEqual({ count: 3, upright: 2, reversed: 1 })
    expect(stats['wands-01']).toEqual({ count: 1, upright: 0, reversed: 1 })
    expect(collectedCount(stats, cards)).toBe(2)
  })

  it('未收录的 cardId（旧皮肤/异常数据）不炸，也计入统计', () => {
    const stats = collectionStats([r([{ cardId: 'ghost-card' }])])
    expect(stats['ghost-card'].count).toBe(1)
    expect(collectedCount(stats, cards)).toBe(0)
  })

  it('cards 为 null/undefined 的记录整体跳过，不炸', () => {
    expect(collectionStats([r(null), r(undefined)])).toEqual({})
  })

  it('牌位 null/undefined 或 cardId 非字符串一律跳过', () => {
    const stats = collectionStats([r([null, undefined, { cardId: 42 }, { cardId: 'major-00' }])])
    expect(Object.keys(stats)).toEqual(['major-00'])
    expect(stats['major-00']).toEqual({ count: 1, upright: 1, reversed: 0 })
  })

  it('空 cards 数组的记录不产生条目', () => {
    expect(collectionStats([r([])])).toEqual({})
  })
})
