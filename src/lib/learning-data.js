// 导入与本机读取共用的课程数据边界：只保留已知课时、卡牌和有限数值。
import { chapters } from './learning-path.js'
import cards from '../data/cards.json'

const object = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const nonnegative = (v) => Number.isFinite(v) && v >= 0
const cardIds = new Set(cards.map((c) => c.id))
const chapterIds = new Set(chapters.map((c) => c.id))

export function sanitizeLearning(raw) {
  if (!object(raw) || !Array.isArray(raw.unlocked) || !object(raw.progress)) return null
  if (raw.unlocked.some((id) => typeof id !== 'string')) return null
  const progress = {}
  for (const chapter of chapters) {
    const saved = raw.progress[chapter.id]
    if (!object(saved)) continue
    progress[chapter.id] = Object.fromEntries(chapter.lessons.filter((l) => saved[l.id] === true).map((l) => [l.id, true]))
  }
  const sr = Object.fromEntries(Object.entries(object(raw.sr) ? raw.sr : {}).filter(([id, value]) =>
    cardIds.has(id) && object(value) && Number.isFinite(value.ease) && value.ease >= 1 &&
    ['interval', 'due', 'reps'].every((key) => nonnegative(value[key]))
  ).map(([id, value]) => [id, { ease: value.ease, interval: value.interval, due: value.due, reps: Math.floor(value.reps) }]))
  const reviewLog = Object.fromEntries(Object.entries(object(raw.reviewLog) ? raw.reviewLog : {})
    .filter(([key, value]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && nonnegative(value))
    .map(([key, value]) => [key, Math.floor(value)]))
  return {
    progress, sr, reviewLog,
    unlocked: [...new Set(['ch-01', ...raw.unlocked.filter((id) => chapterIds.has(id))])],
    totalReviews: nonnegative(raw.totalReviews) ? Math.floor(raw.totalReviews) : 0
  }
}
