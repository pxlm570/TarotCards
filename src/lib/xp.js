// XP 与 22 大阿尔克那等级（M3 Task 4）。level n 对应大阿尔克那 n-1（Lv.1 愚人…Lv.22 世界）。
// 达到 level n 所需累计 XP = threshold(n) = 50*n*(n-1)。

export function threshold(n) {
  return 50 * n * (n - 1)
}

export function levelFromXp(xp) {
  let n = 1
  while (n < 22 && threshold(n + 1) <= xp) n++
  return n
}

export function levelCardId(level) {
  return `major-${String(level - 1).padStart(2, '0')}`
}

export function levelProgress(xp) {
  const level = levelFromXp(xp)
  const current = threshold(level)
  const next = level < 22 ? threshold(level + 1) : current
  const into = xp - current
  const span = Math.max(1, next - current)
  return { level, into, span, pct: next > current ? into / span : 1 }
}
