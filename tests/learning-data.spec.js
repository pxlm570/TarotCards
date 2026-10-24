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

  it('progress：只保留已知章节的已知课时且值须为 true，未知章节/非对象章节整体跳过', () => {
    const out = sanitizeLearning({
      unlocked: ['ch-01'],
      progress: {
        'ch-01': { 'ch-01-l1': true, 'ch-01-l2': false, 'ch-01-bogus': true, bogus: true },
        'ch-xx': { 'ch-01-l1': true }, // 未知章节键被跳过
        'ch-02': 'junk' // 非对象章节进度被跳过
      }
    })
    expect(out.progress).toEqual({ 'ch-01': { 'ch-01-l1': true } })
  })

  it('顶层拒绝：非对象（含数组/字符串）、unlocked 非数组、progress 非对象', () => {
    expect(sanitizeLearning(null)).toBeNull()
    expect(sanitizeLearning('junk')).toBeNull()
    expect(sanitizeLearning([])).toBeNull()
    expect(sanitizeLearning({ unlocked: 'ch-01', progress: {} })).toBeNull()
    expect(sanitizeLearning({ unlocked: [], progress: 'junk' })).toBeNull()
  })

  it('totalReviews：非有限数（NaN/Infinity/字符串）或负数归 0', () => {
    expect(sanitizeLearning({ ...base, totalReviews: NaN }).totalReviews).toBe(0)
    expect(sanitizeLearning({ ...base, totalReviews: Infinity }).totalReviews).toBe(0)
    expect(sanitizeLearning({ ...base, totalReviews: '9' }).totalReviews).toBe(0)
    expect(sanitizeLearning({ ...base, totalReviews: -3 }).totalReviews).toBe(0)
  })

  it('sr/reviewLog 缺失或非对象归空对象，ch-01 始终解锁', () => {
    const out = sanitizeLearning({ unlocked: [], progress: {}, sr: 42, reviewLog: 'junk' })
    expect(out.sr).toEqual({})
    expect(out.reviewLog).toEqual({})
    expect(out.unlocked).toEqual(['ch-01'])
    const missing = sanitizeLearning({ unlocked: [], progress: {} })
    expect(missing.sr).toEqual({})
    expect(missing.reviewLog).toEqual({})
  })
})
