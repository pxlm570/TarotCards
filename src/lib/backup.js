// 数据导出/导入（M3 Task 7）：汇总全部 tarot.*.v1 键为一份 JSON。
// 导入收口（评审 2026-09-06）：备份是唯一绕过 store 校验直达 localStorage 的写入通道，
// 各键逐一经 sanitizer 归一——结构非法的键跳过（返回跳过清单交 UI 提示），坏值回默认，
// journal 条目级过滤（缺 cards/ts 崩 Mirror/时间线），dailyDraws 悬空引用随淘汰同步清理。
import { safeGetItem, safeSetItem, clearFlow } from './storage.js'
import { JOURNAL_MAX, loadJournal } from './journal-store.js'
import { sanitizeLearning } from './learning-data.js'
import { sanitizeCustomSpreads } from './custom-spreads.js'
import { sanitizeJournal, sanitizeProfile, sanitizeAchievements, sanitizeChallenge } from './persisted-data.js'

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
  if (!obj || obj.version !== BACKUP_VERSION || !obj.data || typeof obj.data !== 'object' || Array.isArray(obj.data)) {
    throw new Error('文件格式不正确或版本不受支持')
  }
  return obj
}

function pruneDailyDraws(draws, keepIds) {
  // 值必须是仍存在的 reading id：被淘汰/非法的引用会让连胜虚计、小目标误判
  return Object.fromEntries(
    Object.entries(draws || {}).filter(([, rid]) => typeof rid === 'string' && keepIds.has(rid))
  )
}

// journal 归一化：非法结构拒绝导入（防止坏文件把现库静默清零），并守住 500 条容量上限
function normalizeJournal(raw) {
  if (raw == null) return null
  const result = sanitizeJournal(raw, JOURNAL_MAX)
  if (!result) throw new Error('记录库数据结构不完整，未导入数据')
  return result
}

// settings 在读取时逐字段校验；其他数据导入与本地读取采用同一契约。
const SANITIZERS = {
  'tarot.learning.v1': sanitizeLearning,
  'tarot.custom-spreads.v1': sanitizeCustomSpreads,
  'tarot.profile.v1': sanitizeProfile,
  'tarot.achievements.v1': sanitizeAchievements,
  'tarot.challenge.v1': sanitizeChallenge
}

function sanitizeKey(key, raw, skipped) {
  const fn = SANITIZERS[key]
  if (!fn) return raw
  const v = fn(raw)
  if (v === null) {
    skipped.push(key)
    return undefined
  }
  return v
}

/** 导入。返回被跳过的键名数组（空数组 = 全部有效），供 UI 提示「部分数据无效」。 */
export function applyImport(backup, mode = 'merge') {
  const raw = backup.data || {}
  const skipped = Object.keys(raw).filter((key) => !KEYS.includes(key))
  const data = Object.fromEntries(Object.entries(raw).filter(([key]) => KEYS.includes(key)))
  const journal = 'tarot.journal.v1' in data ? normalizeJournal(data['tarot.journal.v1']) : null
  // 全部准备好再写入，结构异常不会发生在写入了一部分键之后。
  for (const key of Object.keys(data)) {
    if (key === 'tarot.journal.v1') continue
    const value = sanitizeKey(key, data[key], skipped)
    if (value === undefined) delete data[key]
    else data[key] = value
  }
  if (mode === 'overwrite') {
    for (const k of Object.keys(data)) {
      if (k === 'tarot.journal.v1') {
        if (journal) safeSetItem(k, JSON.stringify(journal))
      } else {
        const v = data[k]
        if (v !== undefined) safeSetItem(k, JSON.stringify(v))
      }
    }
    // 覆盖后进行中 flow 的 journalId 已不在新库里：不清掉会被「继续占卜」复活成假记录
    clearFlow()
    return skipped
  }
  // merge：readings 按 id 去重合并，其余键覆盖
  for (const k of Object.keys(data)) {
    if (k === 'tarot.journal.v1' && journal) {
      const existing = loadJournal()
      const ids = new Set((existing.readings || []).map((r) => r.id))
      // 按 ts 排序后再裁剪：淘汰「最旧」而非数组尾部（库满时合并入的新记录曾被误淘汰）
      const merged = [...(existing.readings || []), ...journal.readings.filter((r) => !ids.has(r.id))]
        .sort((a, b) => b.ts - a.ts)
        .slice(0, JOURNAL_MAX)
      const keepIds = new Set(merged.map((r) => r.id))
      const dailyDraws = pruneDailyDraws({ ...(existing.dailyDraws || {}), ...journal.dailyDraws }, keepIds)
      safeSetItem(k, JSON.stringify({ readings: merged, dailyDraws }))
    } else if (k !== 'tarot.journal.v1') {
      const v = data[k]
      if (v !== undefined) safeSetItem(k, JSON.stringify(v))
    }
  }
  return skipped
}
