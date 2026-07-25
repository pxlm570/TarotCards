import { describe, it, expect } from 'vitest'
import cards from '../src/data/cards.json'
import spreads from '../src/data/spreads.json'

const DOMAINS = ['love', 'career', 'wealth', 'study']
const ARCANA = ['major', 'wands', 'cups', 'swords', 'pentacles']

describe('cards.json', () => {
  it('恰好 78 张牌', () => {
    expect(cards).toHaveLength(78)
  })

  it('id 全局唯一', () => {
    const ids = cards.map((c) => c.id)
    expect(new Set(ids).size).toBe(78)
  })

  it('22 大牌 + 56 小牌，id 与编号规则正确', () => {
    const majors = cards.filter((c) => c.arcana === 'major')
    expect(majors).toHaveLength(22)
    majors.forEach((c, i) => {
      expect(c.id).toBe(`major-${String(i).padStart(2, '0')}`)
      expect(c.number).toBe(i)
    })
    for (const suit of ['wands', 'cups', 'swords', 'pentacles']) {
      const minor = cards.filter((c) => c.arcana === suit)
      expect(minor).toHaveLength(14)
      minor.forEach((c, i) => {
        expect(c.id).toBe(`${suit}-${String(i + 1).padStart(2, '0')}`)
        expect(c.number).toBe(i + 1)
      })
    }
  })

  it('每张牌核心字段非空', () => {
    for (const card of cards) {
      expect(card.id, 'id').toBeTruthy()
      expect(card.name, `${card.id} name`).toBeTruthy()
      expect(card.nameEn, `${card.id} nameEn`).toBeTruthy()
      expect(ARCANA, `${card.id} arcana`).toContain(card.arcana)
      expect(typeof card.number, `${card.id} number`).toBe('number')

      const { keywords, meaning } = card
      expect(keywords.upright.length, `${card.id} keywords.upright`).toBeGreaterThan(0)
      expect(keywords.reversed.length, `${card.id} keywords.reversed`).toBeGreaterThan(0)
      for (const kw of [...keywords.upright, ...keywords.reversed]) {
        expect(kw.trim(), `${card.id} 关键词非空`).toBeTruthy()
      }
      expect(meaning.upright.trim(), `${card.id} meaning.upright`).toBeTruthy()
      expect(meaning.reversed.trim(), `${card.id} meaning.reversed`).toBeTruthy()
    }
  })

  it('domains 若存在则四领域结构合法（允许缺失）', () => {
    for (const card of cards) {
      if (!('domains' in card)) continue
      for (const key of DOMAINS) {
        const d = card.domains[key]
        expect(d, `${card.id} domains.${key}`).toBeDefined()
        expect(typeof d.upright, `${card.id} domains.${key}.upright`).toBe('string')
        expect(typeof d.reversed, `${card.id} domains.${key}.reversed`).toBe('string')
      }
      expect(Object.keys(card.domains).sort(), `${card.id} 领域不多不少`).toEqual([...DOMAINS].sort())
    }
  })

  it('symbols 若存在则为非空字符串', () => {
    for (const card of cards) {
      if (!('symbols' in card)) continue
      expect(card.symbols.trim(), `${card.id} symbols`).toBeTruthy()
    }
  })
})

describe('spreads.json', () => {
  it('包含 5 个牌阵且 id 唯一', () => {
    expect(spreads).toHaveLength(5)
    expect(new Set(spreads.map((s) => s.id)).size).toBe(5)
  })

  it('cardCount 与 positions 长度一致', () => {
    for (const spread of spreads) {
      expect(spread.positions, spread.id).toHaveLength(spread.cardCount)
    }
  })

  it('每个位置字段完整且坐标合法', () => {
    for (const spread of spreads) {
      const keys = new Set()
      for (const pos of spread.positions) {
        expect(pos.key, `${spread.id} key`).toBeTruthy()
        expect(pos.label, `${spread.id}/${pos.key} label`).toBeTruthy()
        expect(pos.meaning, `${spread.id}/${pos.key} meaning`).toBeTruthy()
        expect(pos.x, `${spread.id}/${pos.key} x`).toBeGreaterThanOrEqual(0)
        expect(pos.x, `${spread.id}/${pos.key} x`).toBeLessThanOrEqual(100)
        expect(pos.y, `${spread.id}/${pos.key} y`).toBeGreaterThanOrEqual(0)
        expect(pos.y, `${spread.id}/${pos.key} y`).toBeLessThanOrEqual(100)
        keys.add(pos.key)
      }
      expect(keys.size, `${spread.id} 位置 key 唯一`).toBe(spread.positions.length)
    }
  })
})
