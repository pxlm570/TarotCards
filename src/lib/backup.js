// 数据导出/导入（M3 Task 7）：汇总全部 tarot.*.v1 键为一份 JSON。
import { safeGetItem, safeSetItem } from './storage.js'
import { JOURNAL_MAX } from './journal-store.js'

export const BACKUP_VERSION = 1
const KEYS = [
  'tarot.settings.v1',
  'tarot.journal.v1',
  'tarot.learning.v1',
  'tarot.profile.v1',
  'tarot.achievements.v1',
  // 2026-08 审查补：自定义牌阵是用户创作数据，导出遗漏会在换机后静默丢失
  'tarot.custom-spreads.v1',
  'tarot.challenge.v1'
]

function safeParse(json) {
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function collectBackup() {
  const data = {}
  for (const k of KEYS) {
    const v = safeParse(safeGetItem(k)) // 单键损坏跳过而非让整次导出崩溃
    if (v != null) data[k] = v
  }
  return { version: BACKUP_VERSION, exportedAt: Date.now(), data }
}

export function parseImport(text) {
  const obj = JSON.parse(text)
  if (!obj || obj.version !== BACKUP_VERSION || !obj.data || typeof obj.data !== 'object') {
    throw new Error('文件格式不正确或版本不受支持')
  }
  return obj
}

// journal 归一化：非法结构拒绝导入（防止坏文件把现库静默清零），并守住 500 条容量上限
function normalizeJournal(raw) {
  if (raw == null) return null
  if (!Array.isArray(raw.readings) || !raw.dailyDraws || typeof raw.dailyDraws !== 'object') {
    throw new Error('记录库数据结构不完整，已跳过 tarot.journal.v1')
  }
  return {
    readings: raw.readings.filter((r) => r && typeof r.id === 'string').slice(0, JOURNAL_MAX),
    dailyDraws: raw.dailyDraws
  }
}

export function applyImport(backup, mode = 'merge') {
  const data = backup.data || {}
  const journal = 'tarot.journal.v1' in data ? normalizeJournal(data['tarot.journal.v1']) : null
  if (mode === 'overwrite') {
    for (const k of Object.keys(data)) {
      if (k === 'tarot.journal.v1') {
        if (journal) safeSetItem(k, JSON.stringify(journal))
      } else {
        safeSetItem(k, JSON.stringify(data[k]))
      }
    }
    return
  }
  // merge：readings 按 id 去重合并，其余键覆盖
  for (const k of Object.keys(data)) {
    if (k === 'tarot.journal.v1' && journal) {
      const existing = safeParse(safeGetItem(k)) || { readings: [], dailyDraws: {} }
      const ids = new Set((existing.readings || []).map((r) => r.id))
      const merged = [...(existing.readings || []), ...journal.readings.filter((r) => !ids.has(r.id))].slice(0, JOURNAL_MAX)
      safeSetItem(k, JSON.stringify({ readings: merged, dailyDraws: { ...(existing.dailyDraws || {}), ...journal.dailyDraws } }))
    } else if (k !== 'tarot.journal.v1') {
      safeSetItem(k, JSON.stringify(data[k]))
    }
  }
}
