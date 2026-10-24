import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
// isolate:false：先清模块缓存，防同 worker 其他文件缓存过被 mock 的 reading/journal 依赖
vi.hoisted(() => vi.resetModules())
import { setActivePinia, createPinia } from 'pinia'
import { useReadingStore } from '../src/stores/reading.js'
import { useJournalStore } from '../src/stores/journal.js'
import { createReadingRecord } from '../src/lib/reading-record.js'
import { currentDayKey } from '../src/lib/day-key.js'

const SPREAD_3 = 'time-flow' // 3 张：past/present/future

// 复刻 InterpretationView.ensureSaved 的落库段（纯 store 层，不挂载视图）
function ensureSaved(store, journal) {
  let id = store.journalId
  if (!id) {
    try {
      id = crypto.randomUUID()
    } catch {
      id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    }
    journal.addReading(createReadingRecord(store, id, ''))
    store.journalId = id
    store.persistNow()
  } else if (!journal.getById(id)) {
    journal.addReading(createReadingRecord(store, id, ''))
  }
  if (store.isDaily) {
    journal.markDaily(store.dailyDayKey || currentDayKey(), id)
  }
  return id
}

// 每日局走线：isDaily/dailyDayKey 需在 selectSpread 后、beginBreathing 前置位（随 flow 快照）
function walkDailyToInterpreting(store, question = '测试问题') {
  store.selectSpread(SPREAD_3)
  store.isDaily = true
  store.dailyDayKey = currentDayKey() // 进局时定格
  store.beginBreathing()
  store.toQuestion()
  store.submitQuestion(question, null)
  store.finishShuffle()
  store.pickAll()
  store.revealAll()
  store.goInterpret()
  return store
}

describe('薄集成：抽牌动线 → journal 落库 → 每日打卡跨日', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('每日局走完落库：当日打卡命中该记录（cards/spreadId/isDaily 合理），次日查不到', () => {
    const store = useReadingStore()
    const journal = useJournalStore()
    store.selectSpread(SPREAD_3)
    store.isDaily = true
    store.dailyDayKey = '2026-10-23' // 定格到固定日，便于断言跨日隔离
    store.beginBreathing()
    store.toQuestion()
    store.submitQuestion('今天的能量如何？', null)
    store.finishShuffle()
    store.pickAll()
    store.revealAll()
    store.goInterpret()
    expect(store.phase).toBe('interpreting')

    const id = ensureSaved(store, journal)
    expect(store.journalId).toBe(id)

    // 当日打卡命中该记录，字段来自动线状态
    const rec = journal.dailyReading('2026-10-23')
    expect(rec).toBeTruthy()
    expect(rec.id).toBe(id)
    expect(rec.isDaily).toBe(true)
    expect(rec.spreadId).toBe(SPREAD_3)
    expect(rec.question).toBe('今天的能量如何？')
    expect(rec.domain).toBeNull()
    expect(rec.cards).toHaveLength(3)
    expect(rec.cards.map((c) => c.positionKey)).toEqual(['past', 'present', 'future'])
    expect(rec.cards.every((c) => typeof c.cardId === 'string' && typeof c.reversed === 'boolean')).toBe(true)

    // 跨日隔离：次日与再日均查不到今天这局
    expect(journal.dailyReading('2026-10-24')).toBeNull()
    expect(journal.dailyReading('2026-10-25')).toBeNull()
  })

  it('跨凌晨 4 点：假时间换日后新 pinia 重载，旧日打卡仍在、新日无打卡', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-23T23:30:00')) // 4 点界前：深夜局
    const store = useReadingStore()
    const journal = useJournalStore()
    walkDailyToInterpreting(store, '睡前一问')
    expect(store.dailyDayKey).toBe('2026-10-23')
    ensureSaved(store, journal)

    // 跨过凌晨 4 点（10-24 05:00），模拟刷新后重载 journal store
    vi.setSystemTime(new Date('2026-10-24T05:00:00'))
    setActivePinia(createPinia())
    const reloaded = useJournalStore()
    expect(reloaded.dailyReading('2026-10-23')?.id).toBe(store.journalId)
    expect(reloaded.dailyReading('2026-10-24')).toBeNull()
    expect(reloaded.dailyReading(currentDayKey())).toBeNull() // 新的一天没有打卡
  })
})
