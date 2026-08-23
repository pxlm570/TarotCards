import { describe, it, expect } from 'vitest'
import cards from '../src/data/cards.json'
import spreads from '../src/data/spreads.json'
import moonPhases from '../src/data/moon-phases.json'
import seasons from '../src/data/seasons.json'

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
  it('包含 12 个牌阵且 id 唯一', () => {
    expect(spreads).toHaveLength(12)
    expect(new Set(spreads.map((s) => s.id)).size).toBe(12)
  })

  it('四个四季仪式牌阵 ritual 标记与 id 一致（v1.5 Task 4）', () => {
    const seasons = spreads.filter((s) => s.id.endsWith('-equinox') || s.id.endsWith('-solstice'))
    expect(seasons.map((s) => s.id).sort()).toEqual([
      'autumn-equinox',
      'spring-equinox',
      'summer-solstice',
      'winter-solstice'
    ])
    for (const s of seasons) expect(s.ritual, s.id).toBe(s.id)
  })

  it('cardCount 与 positions 长度一致', () => {
    for (const spread of spreads) {
      expect(spread.positions, spread.id).toHaveLength(spread.cardCount)
    }
  })

  it('每个牌阵都带选择指引三要素（v1.5 牌阵说明弹窗）', () => {
    for (const spread of spreads) {
      expect(spread.guide, spread.id).toBeTruthy()
      expect(spread.guide.fit, `${spread.id}/fit`).toBeTruthy()
      expect(spread.guide.who, `${spread.id}/who`).toBeTruthy()
      expect(spread.guide.tip, `${spread.id}/tip`).toBeTruthy()
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

// 2026-07-25 接手固化：内容规范此前只靠人工把关，补 56 张小牌 domains 时容易被打破
describe('内容规范', () => {
  const SUIT_ELEMENT = { wands: '火', cups: '水', swords: '风', pentacles: '土' }
  const COURT_ELEMENT = { 11: '土', 12: '火', 13: '水', 14: '风' }
  const countSentences = (text) => Math.max(1, (text.match(/[。！？]/g) || []).length)
  const allTexts = (card) => {
    const list = [card.meaning.upright, card.meaning.reversed, ...card.keywords.upright, ...card.keywords.reversed]
    // symbols 单独校验：允许大写字母（牌面真实绘制的字母如命运之轮 TARO，及形状描述如倒吊人"T 形"）
    if (card.symbols) list.push(card.symbols.replace(/[A-Z]+/g, ''))
    if (card.domains) {
      for (const d of Object.values(card.domains)) list.push(d.upright, d.reversed)
    }
    return list
  }

  it('关键词正逆位各 ≥3 个', () => {
    for (const card of cards) {
      expect(card.keywords.upright.length, `${card.id} 正位关键词数`).toBeGreaterThanOrEqual(3)
      expect(card.keywords.reversed.length, `${card.id} 逆位关键词数`).toBeGreaterThanOrEqual(3)
    }
  })

  it('牌意句数上限：大牌 ≤3 句、小牌 ≤2 句', () => {
    for (const card of cards) {
      const cap = card.arcana === 'major' ? 3 : 2
      expect(countSentences(card.meaning.upright), `${card.id} 正位牌意句数`).toBeLessThanOrEqual(cap)
      expect(countSentences(card.meaning.reversed), `${card.id} 逆位牌意句数`).toBeLessThanOrEqual(cap)
    }
  })

  it('domains 短句每条 ≤2 句', () => {
    for (const card of cards) {
      if (!card.domains) continue
      for (const [key, d] of Object.entries(card.domains)) {
        expect(countSentences(d.upright), `${card.id} domains.${key}.upright 句数`).toBeLessThanOrEqual(2)
        expect(countSentences(d.reversed), `${card.id} domains.${key}.reversed 句数`).toBeLessThanOrEqual(2)
      }
    }
  })

  it('无桩数据残留、无英文混排（全中文定位，nameEn 除外）', () => {
    for (const card of cards) {
      for (const t of allTexts(card)) {
        expect(t.trim(), `${card.id} 空文案`).toBeTruthy()
        expect(t, `${card.id} 桩数据残留: ${t}`).not.toMatch(/TODO|^\s*…+\s*$/)
        expect(t, `${card.id} 英文混排: ${t}`).not.toMatch(/[a-zA-Z]/)
      }
    }
  })

  it('78 张全部必须有完整 domains 与 symbols（2026-07-26 小牌批次补齐后锁定）', () => {
    for (const card of cards) {
      expect(card.domains, `${card.id} domains`).toBeDefined()
      for (const key of ['love', 'career', 'wealth', 'study']) {
        expect(card.domains?.[key]?.upright?.trim(), `${card.id} domains.${key}.upright`).toBeTruthy()
        expect(card.domains?.[key]?.reversed?.trim(), `${card.id} domains.${key}.reversed`).toBeTruthy()
      }
      expect(card.symbols?.trim(), `${card.id} symbols`).toBeTruthy()
    }
  })

  it('element 格式：数字牌=花色元素；宫廷牌=「花色元素之宫廷元素」', () => {
    for (const card of cards.filter((c) => c.arcana !== 'major')) {
      const main = SUIT_ELEMENT[card.arcana]
      if (card.number <= 10) {
        expect(card.element, `${card.id} element`).toBe(main)
      } else {
        expect(card.element, `${card.id} element`).toBe(`${main}之${COURT_ELEMENT[card.number]}`)
      }
    }
  })
})

// 数据地平线守卫（2026-08-24 审查补）：仪式数据只到 2027/2028 年底，到期后
// ritualToday 永远为 null 且无告警。此守卫在数据到期前约一年转红，提醒补数据。
describe('仪式数据新鲜度', () => {
  const horizon = new Date()
  horizon.setFullYear(horizon.getFullYear() + 1)
  const h = horizon.toISOString().slice(0, 10)

  it('月相数据至少覆盖未来 12 个月', () => {
    expect(moonPhases.newMoon.at(-1) >= h, `newMoon 末项 ${moonPhases.newMoon.at(-1)} 应不早于 ${h}，请补数据`).toBe(true)
    expect(moonPhases.fullMoon.at(-1) >= h, `fullMoon 末项 ${moonPhases.fullMoon.at(-1)} 应不早于 ${h}，请补数据`).toBe(true)
  })

  it('节气数据每键至少覆盖未来 12 个月', () => {
    for (const [k, dates] of Object.entries(seasons)) {
      expect(dates.at(-1) >= h, `${k} 末项 ${dates.at(-1)} 应不早于 ${h}，请补数据`).toBe(true)
    }
  })
})
