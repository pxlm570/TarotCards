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
