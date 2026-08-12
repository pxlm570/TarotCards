// 数据导出/导入（M3 Task 7）：汇总全部 tarot.*.v1 键为一份 JSON。
import { safeGetItem, safeSetItem } from './storage.js'

export const BACKUP_VERSION = 1
const KEYS = [
  'tarot.settings.v1',
  'tarot.journal.v1',
  'tarot.learning.v1',
  'tarot.profile.v1',
  'tarot.achievements.v1'
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
    const v = safeGetItem(k)
    if (v != null) data[k] = JSON.parse(v)
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

export function applyImport(backup, mode = 'merge') {
  const data = backup.data || {}
  if (mode === 'overwrite') {
    for (const k of Object.keys(data)) {
      safeSetItem(k, JSON.stringify(data[k]))
    }
    return
  }
  // merge：readings 按 id 去重合并，其余键覆盖
  for (const k of Object.keys(data)) {
    if (k === 'tarot.journal.v1') {
      const existing = safeParse(safeGetItem(k)) || { readings: [], dailyDraws: {} }
      const incoming = data[k] || { readings: [], dailyDraws: {} }
      const ids = new Set((existing.readings || []).map((r) => r.id))
      const merged = [...(existing.readings || []), ...(incoming.readings || []).filter((r) => !ids.has(r.id))]
      safeSetItem(k, JSON.stringify({ readings: merged, dailyDraws: { ...(existing.dailyDraws || {}), ...(incoming.dailyDraws || {}) } }))
    } else {
      safeSetItem(k, JSON.stringify(data[k]))
    }
  }
}
