// 占卜记录存储层（M3 Task 1）。key: tarot.journal.v1 = { readings[], dailyDraws{} }。
// 读写一律走 safe 封装（localStorage 被禁/写满时静默降级）。
import { safeGetItem, safeSetItem } from './storage.js'

const KEY = 'tarot.journal.v1'
export const JOURNAL_MAX = 500 // 容量保护：超出淘汰最旧，提示去导出

function safeParse(json) {
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function loadJournal() {
  const raw = safeParse(safeGetItem(KEY))
  if (raw && Array.isArray(raw.readings) && raw.dailyDraws && typeof raw.dailyDraws === 'object') {
    return raw
  }
  return { readings: [], dailyDraws: {} }
}

function persist(data) {
  safeSetItem(KEY, JSON.stringify(data))
}

export function count() {
  return loadJournal().readings.length
}

export function saveReading(reading) {
  const { readings, dailyDraws } = loadJournal()
  const idx = readings.findIndex((r) => r.id === reading.id)
  let next = [...readings]
  if (idx > -1) next[idx] = reading
  else next = [reading, ...next]
  if (next.length > JOURNAL_MAX) next = next.slice(0, JOURNAL_MAX)
  persist({ readings: next, dailyDraws })
  return reading
}

export function updateNote(id, note) {
  const { readings, dailyDraws } = loadJournal()
  const r = readings.find((x) => x.id === id)
  if (!r) return false
  persist({ readings: readings.map((x) => (x.id === id ? { ...x, note } : x)), dailyDraws })
  return true
}

export function getById(id) {
  return loadJournal().readings.find((r) => r.id === id)
}

export function listReadings({ limit, offset = 0 } = {}) {
  const { readings } = loadJournal()
  // readings 恒按新→旧排列（saveReading unshift），直接切片
  const start = offset
  const end = limit == null ? readings.length : offset + limit
  return readings.slice(start, end)
}

export function deleteReading(id) {
  const { readings, dailyDraws } = loadJournal()
  persist({
    readings: readings.filter((r) => r.id !== id),
    dailyDraws: Object.fromEntries(Object.entries(dailyDraws).filter(([, rid]) => rid !== id))
  })
  return true
}

export function getDailyDraw(dayKey) {
  return loadJournal().dailyDraws[dayKey]
}

export function setDailyDraw(dayKey, readingId) {
  const { readings, dailyDraws } = loadJournal()
  persist({ readings, dailyDraws: { ...dailyDraws, [dayKey]: readingId } })
  return readingId
}
