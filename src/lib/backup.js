// 数据导出/导入（M3 Task 7）：汇总全部 tarot.*.v1 键为一份 JSON。
// 导入收口（评审 2026-09-06）：备份是唯一绕过 store 校验直达 localStorage 的写入通道，
// 各键逐一经 sanitizer 归一——结构非法的键跳过（返回跳过清单交 UI 提示），坏值回默认，
// journal 条目级过滤（缺 cards/ts 崩 Mirror/时间线），dailyDraws 悬空引用随淘汰同步清理。
import { safeGetItem, safeSetItem, clearFlow } from './storage.js'
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

function pruneDailyDraws(draws, keepIds) {
  // 值必须是仍存在的 reading id：被淘汰/非法的引用会让连胜虚计、小目标误判
  return Object.fromEntries(
    Object.entries(draws || {}).filter(([, rid]) => typeof rid === 'string' && keepIds.has(rid))
  )
}

// journal 归一化：非法结构拒绝导入（防止坏文件把现库静默清零），并守住 500 条容量上限
function normalizeJournal(raw) {
  if (raw == null) return null
  if (!Array.isArray(raw.readings) || !raw.dailyDraws || typeof raw.dailyDraws !== 'object') {
    throw new Error('记录库数据结构不完整，已跳过 tarot.journal.v1')
  }
  const readings = raw.readings
    .filter((r) => r && typeof r.id === 'string' && typeof r.ts === 'number' && Array.isArray(r.cards))
    .map((r) => ({ ...r, cards: r.cards.filter((c) => c && typeof c.cardId === 'string') }))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, JOURNAL_MAX)
  const ids = new Set(readings.map((r) => r.id))
  return { readings, dailyDraws: pruneDailyDraws(raw.dailyDraws, ids) }
}

function sanitizeLearning(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!Array.isArray(raw.unlocked) || raw.unlocked.some((c) => typeof c !== 'string')) return null
  if (!raw.progress || typeof raw.progress !== 'object') return null
  return {
    ...raw,
    sr: raw.sr && typeof raw.sr === 'object' ? raw.sr : {},
    reviewLog: raw.reviewLog && typeof raw.reviewLog === 'object' ? raw.reviewLog : {},
    totalReviews: typeof raw.totalReviews === 'number' ? raw.totalReviews : 0
  }
}

function sanitizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return null
  if ('xp' in raw && typeof raw.xp !== 'number') return null
  if ('maxStreak' in raw && typeof raw.maxStreak !== 'number') return null
  if ('birthday' in raw && typeof raw.birthday !== 'string') return null
  return raw
}

// 其余键不在此列：settings 载入时逐字段校验、achievements/custom-spreads 各自归一化，
// challenge 仅为小计数对象，坏值的影响面各自可控
const SANITIZERS = {
  'tarot.learning.v1': sanitizeLearning,
  'tarot.profile.v1': sanitizeProfile
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
  const data = backup.data || {}
  const skipped = []
  const journal = 'tarot.journal.v1' in data ? normalizeJournal(data['tarot.journal.v1']) : null
  if (mode === 'overwrite') {
    for (const k of Object.keys(data)) {
      if (k === 'tarot.journal.v1') {
        if (journal) safeSetItem(k, JSON.stringify(journal))
      } else {
        const v = sanitizeKey(k, data[k], skipped)
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
      const existing = safeParse(safeGetItem(k)) || { readings: [], dailyDraws: {} }
      const ids = new Set((existing.readings || []).map((r) => r.id))
      // 按 ts 排序后再裁剪：淘汰「最旧」而非数组尾部（库满时合并入的新记录曾被误淘汰）
      const merged = [...(existing.readings || []), ...journal.readings.filter((r) => !ids.has(r.id))]
        .sort((a, b) => b.ts - a.ts)
        .slice(0, JOURNAL_MAX)
      const keepIds = new Set(merged.map((r) => r.id))
      const dailyDraws = pruneDailyDraws({ ...(existing.dailyDraws || {}), ...journal.dailyDraws }, keepIds)
      safeSetItem(k, JSON.stringify({ readings: merged, dailyDraws }))
    } else if (k !== 'tarot.journal.v1') {
      const v = sanitizeKey(k, data[k], skipped)
      if (v !== undefined) safeSetItem(k, JSON.stringify(v))
    }
  }
  return skipped
}
