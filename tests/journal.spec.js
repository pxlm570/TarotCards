// 占卜记录存储层（M3 Task 1）：tarot.journal.v1 = { readings[], dailyDraws{} }。
import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadJournal,
  saveReading,
  updateNote,
  listReadings,
  getById,
  deleteReading,
  getDailyDraw,
  setDailyDraw,
  count
} from '../src/lib/journal-store.js'

function sample(overrides = {}) {
  return {
    id: 'uuid-1',
    ts: 1784880000000,
    spreadId: 'time-flow',
    question: '我的事业方向？',
    domain: 'career',
    cards: [{ cardId: 'major-00', positionKey: 'past', reversed: false }],
    note: '',
    isDaily: false,
    ...overrides
  }
}

describe('journal-store', () => {
  beforeEach(() => localStorage.clear())

  it('默认空库：readings 空、dailyDraws 空', () => {
    expect(loadJournal()).toEqual({ readings: [], dailyDraws: {} })
  })

  it('saveReading 入库并持久化，新记录排前（时间倒序）', () => {
    saveReading(sample({ id: 'a', ts: 100 }))
    saveReading(sample({ id: 'b', ts: 200 }))
    const { readings } = loadJournal()
    expect(readings.map((r) => r.id)).toEqual(['b', 'a'])
    expect(localStorage.getItem('tarot.journal.v1')).toBeTruthy()
  })

  it('listReadings 按时间倒序 + limit/offset', () => {
    saveReading(sample({ id: 'a', ts: 100 }))
    saveReading(sample({ id: 'b', ts: 200 }))
    saveReading(sample({ id: 'c', ts: 300 }))
    expect(listReadings().map((r) => r.id)).toEqual(['c', 'b', 'a'])
    expect(listReadings({ limit: 2 }).map((r) => r.id)).toEqual(['c', 'b'])
    expect(listReadings({ limit: 2, offset: 1 }).map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('updateNote 补写日记，不新增记录', () => {
    saveReading(sample({ id: 'a' }))
    updateNote('a', '今天感觉不错')
    const r = getById('a')
    expect(r.note).toBe('今天感觉不错')
    expect(count()).toBe(1)
  })

  it('deleteReading 删除指定记录', () => {
    saveReading(sample({ id: 'a' }))
    saveReading(sample({ id: 'b' }))
    deleteReading('a')
    expect(getById('a')).toBeUndefined()
    expect(count()).toBe(1)
    expect(getById('b')).toBeTruthy()
  })

  it('dailyDraws 按 dayKey 读写', () => {
    setDailyDraw('2026-07-25', 'uuid-1')
    expect(getDailyDraw('2026-07-25')).toBe('uuid-1')
    expect(getDailyDraw('2026-07-26')).toBeUndefined()
  })

  it('getById 不存在时返回 undefined', () => {
    expect(getById('no-such')).toBeUndefined()
  })

  it('容量保护：超过上限删除最旧（保留最新 MAX）', () => {
    for (let i = 0; i < 505; i++) saveReading(sample({ id: `r${i}`, ts: i }))
    expect(count()).toBeLessThanOrEqual(500)
    // 最早的 r0.. 被淘汰，最新的保留
    expect(getById('r504')).toBeTruthy()
    expect(getById('r0')).toBeUndefined()
  })
})
