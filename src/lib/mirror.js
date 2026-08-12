// Mirror 聚合统计（M3 Task 5）：读 readings 数组的纯函数。
import { currentDayKey } from './day-key.js'

export function topCards(readings, n = 5) {
  const counts = {}
  for (const r of readings) {
    for (const c of r.cards) counts[c.cardId] = (counts[c.cardId] || 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([cardId, count]) => ({ cardId, count }))
}

export function suitDist(readings) {
  const dist = { major: 0, wands: 0, cups: 0, swords: 0, pentacles: 0 }
  for (const r of readings) {
    for (const c of r.cards) {
      const suit = c.cardId.split('-')[0]
      if (suit in dist) dist[suit]++
    }
  }
  return dist
}

export function orientationDist(readings) {
  let upright = 0
  let reversed = 0
  for (const r of readings) {
    for (const c of r.cards) (c.reversed ? reversed++ : upright++)
  }
  return { upright, reversed }
}

export function domainDist(readings) {
  const dist = { love: 0, career: 0, wealth: 0, study: 0, general: 0 }
  for (const r of readings) {
    const d = r.domain
    if (d && d in dist) dist[d]++
    else dist.general++ // null（随心）计入综合
  }
  return dist
}

export function dailyFreq(readings, days = 30, today = new Date()) {
  const counts = {}
  for (const r of readings) {
    const key = currentDayKey(new Date(r.ts))
    counts[key] = (counts[key] || 0) + 1
  }
  const arr = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setHours(d.getHours() - 4) // 与 dayKey 分界一致
    d.setDate(d.getDate() - i)
    const key = currentDayKey(d)
    arr.push({ key, count: counts[key] || 0 })
  }
  return arr
}
