// 导入与本机读取共用纯校验，未知条目不进入业务层。
import cards from '../data/cards.json'
import achievements from '../data/achievements.json'
import { snapshotSpread } from './reading-record.js'
const object = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const count = (v) => Number.isFinite(v) && v >= 0
const text = (v) => typeof v === 'string' ? v : ''
const cardIds = new Set(cards.map((c) => c.id))
const achievementIds = new Set(achievements.map((a) => a.id))

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T12:00:00')
  const [y, m, d] = value.split('-').map(Number)
  return date.getFullYear() === y && date.getMonth() + 1 === m && date.getDate() === d
}

export function sanitizeProfile(raw) {
  if (!object(raw)) return null
  if (['xp', 'maxStreak'].some((key) => key in raw && !count(raw[key]))) return null
  if ('birthday' in raw && typeof raw.birthday !== 'string') return null
  const birthday = validDate(raw.birthday) && new Date(raw.birthday + 'T00:00:00') <= new Date() ? raw.birthday : ''
  return { xp: raw.xp ?? 0, maxStreak: raw.maxStreak ?? 0, birthday }
}

export function sanitizeAchievements(raw) {
  if (!object(raw) || !Array.isArray(raw.unlocked)) return null
  return { unlocked: [...new Set(raw.unlocked.filter((id) => achievementIds.has(id)))] }
}

export function sanitizeChallenge(raw) {
  if (!object(raw)) return null
  return { count: count(raw.count) ? Math.floor(raw.count) : 0, last: validDate(raw.last) ? raw.last : '' }
}

export function sanitizeJournal(raw, limit = 500) {
  if (!object(raw) || !Array.isArray(raw.readings) || !object(raw.dailyDraws)) return null
  const seen = new Set()
  const readings = raw.readings.filter((r) => object(r) && typeof r.id === 'string' && r.id &&
    Number.isFinite(r.ts) && Number.isFinite(new Date(r.ts).getTime()) && Array.isArray(r.cards))
    .sort((a, b) => b.ts - a.ts).filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true })
    .slice(0, limit).map((r) => {
      const result = { ...r, question: text(r.question), note: text(r.note),
        cards: r.cards.filter((c) => object(c) && cardIds.has(c.cardId)).map((c) => ({ ...c, reversed: c.reversed === true })) }
      const snapshot = snapshotSpread(r.spreadSnapshot)
      delete result.spreadSnapshot
      if (snapshot && snapshot.id === r.spreadId) result.spreadSnapshot = snapshot
      return result
    })
  const ids = new Set(readings.map((r) => r.id))
  return { readings, dailyDraws: Object.fromEntries(Object.entries(raw.dailyDraws)
    .filter(([day, id]) => validDate(day) && typeof id === 'string' && ids.has(id))) }
}
