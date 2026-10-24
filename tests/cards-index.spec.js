// src/lib/cards.js：牌 id → 定义的全局索引，视图/组件统一走 cardById，避免各自 new Map。
import { describe, it, expect } from 'vitest'
import cardsData from '../src/data/cards.json'
import { cardById } from '../src/lib/cards.js'

describe('cardById 牌面索引', () => {
  it('覆盖 cards.json 全量（78 张）', () => {
    expect(cardsData).toHaveLength(78)
    expect(cardById.size).toBe(78)
  })

  it('已知 id 可查且 name 为非空字符串', () => {
    const fool = cardById.get('major-00')
    expect(fool).toBeTruthy()
    expect(typeof fool.name).toBe('string')
    expect(fool.name.length).toBeGreaterThan(0)

    const ace = cardById.get('wands-01')
    expect(ace).toBeTruthy()
    expect(typeof ace.name).toBe('string')
    expect(ace.name.length).toBeGreaterThan(0)
  })

  it('未知 id 为 undefined', () => {
    expect(cardById.get('major-99')).toBeUndefined()
    expect(cardById.get('')).toBeUndefined()
  })
})
