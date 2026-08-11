// 闪卡间隔重复（SM-2 精简版，M2 Task 2）。
// 状态：{ ease, interval(天), due(时间戳), reps }。评分三档：
//   again → 归零，10 分钟后重来
//   hard  → interval = max(1, floor(interval * 1.5)) 天
//   good  → interval = interval === 0 ? 1 : interval * ease 天
// 返回新对象（不可变），due 基于调用时刻 Date.now()。

const DAY = 24 * 3600 * 1000
const AGAIN_MINUTES = 10

export function newCard() {
  return { ease: 2.5, interval: 0, reps: 0, due: Date.now() }
}

export function review(card, rating) {
  const now = Date.now()
  if (rating === 'again') {
    return { ...card, reps: 0, interval: 0, due: now + AGAIN_MINUTES * 60 * 1000 }
  }
  if (rating === 'hard') {
    const interval = Math.max(1, Math.floor(card.interval * 1.5))
    return { ...card, interval, reps: card.reps + 1, due: now + interval * DAY }
  }
  // good
  const interval = card.interval === 0 ? 1 : card.interval * card.ease
  return { ...card, interval, reps: card.reps + 1, due: now + interval * DAY }
}

export function dueCards(cards, now = Date.now()) {
  return cards.filter((c) => c.due <= now)
}
