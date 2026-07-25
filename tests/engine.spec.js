import { describe, it, expect } from 'vitest'
import { shuffleDeck, drawCards } from '../src/lib/tarot-engine.js'

describe('tarot-engine', () => {
  it('shuffle 保持 78 张且不重复', () => {
    const deck = Array.from({ length: 78 }, (_, i) => i)
    const out = shuffleDeck(deck)
    expect(out).toHaveLength(78)
    expect(new Set(out).size).toBe(78)
  })

  it('draw 返回 n 张且带正逆位', () => {
    const deck = Array.from({ length: 78 }, (_, i) => i)
    const drawn = drawCards(deck, 3, { allowReversed: true })
    expect(drawn).toHaveLength(3)
    drawn.forEach((c) => expect(typeof c.reversed).toBe('boolean'))
  })

  it('关闭逆位时全部正位', () => {
    const deck = Array.from({ length: 78 }, (_, i) => i)
    drawCards(deck, 20, { allowReversed: false }).forEach((c) => expect(c.reversed).toBe(false))
  })

  it('抽出的牌不重复', () => {
    const deck = Array.from({ length: 78 }, (_, i) => i)
    const drawn = drawCards(deck, 10, { allowReversed: true })
    expect(new Set(drawn.map((c) => c.id)).size).toBe(10)
  })

  it('n=0 时返回空数组', () => {
    const deck = Array.from({ length: 78 }, (_, i) => i)
    expect(drawCards(deck, 0, { allowReversed: true })).toEqual([])
  })

  it('n=78 时抽完整副牌且不重复', () => {
    const deck = Array.from({ length: 78 }, (_, i) => i)
    const drawn = drawCards(deck, 78, { allowReversed: true })
    expect(drawn).toHaveLength(78)
    expect(new Set(drawn.map((c) => c.id)).size).toBe(78)
  })

  it('支持字符串 id 牌堆（如 major-00）', () => {
    const deck = Array.from({ length: 78 }, (_, i) => `major-${String(i).padStart(2, '0')}`)
    const shuffled = shuffleDeck(deck)
    expect(shuffled).toHaveLength(78)
    expect(new Set(shuffled).size).toBe(78)
    shuffled.forEach((id) => expect(deck).toContain(id))

    const drawn = drawCards(deck, 3, { allowReversed: true })
    expect(drawn).toHaveLength(3)
    drawn.forEach((c) => {
      expect(deck).toContain(c.id)
      expect(typeof c.reversed).toBe('boolean')
    })
  })

  it('shuffle 不修改原数组（不可变）', () => {
    const deck = Array.from({ length: 78 }, (_, i) => i)
    const snapshot = [...deck]
    shuffleDeck(deck)
    expect(deck).toEqual(snapshot)
  })

  it('draw 不消耗原牌堆', () => {
    const deck = Array.from({ length: 78 }, (_, i) => i)
    drawCards(deck, 5, { allowReversed: true })
    expect(deck).toHaveLength(78)
  })

  it('n 为负数或非整数时抛 RangeError', () => {
    const deck = Array.from({ length: 78 }, (_, i) => i)
    expect(() => drawCards(deck, -1)).toThrow(RangeError)
    expect(() => drawCards(deck, 1.5)).toThrow(RangeError)
  })

  it('n 超过牌堆长度时抛 RangeError', () => {
    const deck = Array.from({ length: 78 }, (_, i) => i)
    expect(() => drawCards(deck, 79)).toThrow(RangeError)
    expect(() => drawCards([], 1)).toThrow(RangeError)
  })

  it('空牌堆 shuffle 返回空数组', () => {
    expect(shuffleDeck([])).toEqual([])
  })
})
