// 连胜计算（M3 Task 3）。dates 为已打卡的 YYYY-MM-DD（本地时区），today 同格式。
// 不含 -4h 逻辑——dayKey 的换算统一由 lib/day-key.js 负责，这里只做纯日期运算。

function toDayStr(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

function offset(dayStr, days) {
  const d = new Date(dayStr + 'T12:00:00') // 正午构造，避免时区/夏令时边界
  d.setDate(d.getDate() + days)
  return toDayStr(d)
}

function countBack(set, from) {
  let n = 0
  let cur = from
  while (set.has(cur)) {
    n++
    cur = offset(cur, -1)
  }
  return n
}

export function calcStreak(dates, today) {
  const set = new Set(dates)
  if (set.has(today)) return countBack(set, today)
  const y = offset(today, -1)
  return set.has(y) ? countBack(set, y) : 0 // 今日未打卡但昨日有：连胜暂存，首页显示「待打卡」
}

export function calcMaxStreak(dates) {
  const set = new Set(dates)
  let best = 0
  for (const day of set) {
    // 只从每段连续的首日向后数，避免重复 O(n²)
    if (set.has(offset(day, -1))) continue
    let n = 0
    let cur = day
    while (set.has(cur)) {
      n++
      cur = offset(cur, 1)
    }
    if (n > best) best = n
  }
  return best
}
