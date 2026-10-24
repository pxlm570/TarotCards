// sanitizeLearning 纯函数边界：unlocked 清洗与 sr/reviewLog 值级过滤。
// learning.spec / backup.spec 只覆盖「坏 shape 整键拒绝」与「null 值归一」，
// 这里补值级边界：未知章节过滤、非字符串元素、sr 逐条过滤、非法 dayKey、floor 取整。
import { describe, it, expect } from 'vitest'
import { sanitizeLearning } from '../src/lib/learning-data.js'

const base = { unlocked: ['ch-01'], progress: {} }
const due = 1761321600000

describe('sanitizeLearning 值级边界', () => {
  it('unlocked：未知章节过滤且 ch-01 始终保留去重；含非字符串元素整体拒绝', () => {
    const out = sanitizeLearning({ ...base, unlocked: ['ch-03', 'bogus', 'ch-01'] })
    expect(out.unlocked).toEqual(['ch-01', 'ch-03'])
    expect(sanitizeLearning({ ...base, unlocked: ['ch-02', 42] })).toBeNull()
  })

  it('sr/reviewLog/totalReviews：只留合法条目且数值向下取整', () => {
    const out = sanitizeLearning({
      ...base,
      sr: {
        'major-00': { ease: 2.5, interval: 3, due, reps: 4.7 },
        'wands-01': { ease: 0.9, interval: 1, due, reps: 1 }, // ease < 1 丢弃
        'not-a-card': { ease: 2.5, interval: 1, due, reps: 1 }, // 未知牌丢弃
        'cups-13': { ease: 2.5, interval: -1, due, reps: 1 }, // 负数丢弃
        'major-07': 'junk' // 非对象丢弃
      },
      reviewLog: {
        '2026-10-24': 3.9,
        '2026-10-2': 5, // 少一位，非法
        yesterday: 2 // 非日期形状，非法
      },
      totalReviews: 12.9
    })
    expect(out.sr).toEqual({ 'major-00': { ease: 2.5, interval: 3, due, reps: 4 } })
    expect(out.reviewLog).toEqual({ '2026-10-24': 3 })
    expect(out.totalReviews).toBe(12)
  })
})
