// 本命牌算法（M3 Task 6，Mary Greer 法）。锁定用例见计划。
import { describe, it, expect } from 'vitest'
import { birthCards } from '../src/lib/birth-cards.js'

describe('birthCards 锁定用例', () => {
  it('1990-05-23 → 11/2（正义/女祭司）', () => {
    const r = birthCards(1990, 5, 23)
    expect(r.display).toBe('11/2')
    expect(r.personality).toBe(11)
    expect(r.soul).toBe(2)
    expect(r.majors).toEqual(['major-11', 'major-02'])
  })

  it('2000-01-01 → 4（皇帝，单牌）', () => {
    const r = birthCards(2000, 1, 1)
    expect(r.display).toBe('4')
    expect(r.majors).toEqual(['major-04'])
  })

  it('1955-01-01 → 22/4 特例（愚人/皇帝）', () => {
    const r = birthCards(1955, 1, 1)
    expect(r.display).toBe('22/4')
    expect(r.majors).toEqual(['major-00', 'major-04'])
  })

  it('单牌时 personality === soul', () => {
    const r = birthCards(2000, 1, 1)
    expect(r.personality).toBe(r.soul)
  })
})

describe('birthCards 多轮各位相加', () => {
  it('1956-12-31 → 1999 → 28 → 10/1（两次降位）', () => {
    const r = birthCards(1956, 12, 31)
    expect(r.personality).toBe(10)
    expect(r.soul).toBe(1)
    expect(r.display).toBe('10/1')
    expect(r.majors).toEqual(['major-10', 'major-01'])
  })

  it('1906-12-31 → 1949 → 23 → 5（多轮后落单牌）', () => {
    const r = birthCards(1906, 12, 31)
    expect(r.personality).toBe(5)
    expect(r.soul).toBe(5)
    expect(r.display).toBe('5')
    expect(r.majors).toEqual(['major-05'])
  })

  it('1906-12-21 → 1939 → 22 特例（经各位相加落到 22，非直接和）', () => {
    const r = birthCards(1906, 12, 21)
    expect(r.display).toBe('22/4')
    expect(r.personality).toBe(22)
    expect(r.soul).toBe(4)
    expect(r.majors).toEqual(['major-00', 'major-04'])
  })
})
