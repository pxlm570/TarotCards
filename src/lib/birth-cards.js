// 本命牌（M3 Task 6，Mary Greer 法）：人格牌 + 灵魂牌。
// sum = 月 + 日 + 年 整数相加；>22 则各位相加直到 ≤22 得人格牌；22 为特例（愚人/皇帝 22/4）；
// 人格牌各位相加至个位得灵魂牌（相同则只显示一张）。

function digitSum(n) {
  return `${n}`.split('').map(Number).reduce((a, b) => a + b, 0)
}

function cardIdFor(n) {
  return n === 22 ? 'major-00' : `major-${String(n).padStart(2, '0')}`
}

export function birthCards(y, m, d) {
  let p = m + d + y
  while (p > 22) p = digitSum(p)
  if (p === 22) return { personality: 22, soul: 4, display: '22/4', majors: ['major-00', 'major-04'] }
  let s = p
  while (s > 9) s = digitSum(s)
  return {
    personality: p,
    soul: s,
    display: p === s ? `${p}` : `${p}/${s}`,
    majors: p === s ? [cardIdFor(p)] : [cardIdFor(p), cardIdFor(s)]
  }
}
