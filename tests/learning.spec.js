// 学习进度/闯关解锁 store（M2 Task 3）：章节 lesson 完成 → 解锁下一章；
// 今日复习计数（M3 今日小目标数据源）；持久化 tarot.learning.v1。
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLearningStore } from '../src/stores/learning.js'
import { useProfileStore } from '../src/stores/profile.js'
import ch01 from '../src/data/courses/chapter-01.json'
import ch02 from '../src/data/courses/chapter-02.json'
import ch03 from '../src/data/courses/chapter-03.json'
import ch04 from '../src/data/courses/chapter-04.json'
import ch05 from '../src/data/courses/chapter-05.json'
import ch06 from '../src/data/courses/chapter-06.json'
import ch07 from '../src/data/courses/chapter-07.json'

const L1 = ch01.lessons.map((l) => l.id)
const L2 = ch02.lessons.map((l) => l.id)
// 全部七章（graduated 毕业回归用例用）
const ALL_CHAPTERS = [
  ['ch-01', L1],
  ['ch-02', L2],
  ['ch-03', ch03.lessons.map((l) => l.id)],
  ['ch-04', ch04.lessons.map((l) => l.id)],
  ['ch-05', ch05.lessons.map((l) => l.id)],
  ['ch-06', ch06.lessons.map((l) => l.id)],
  ['ch-07', ch07.lessons.map((l) => l.id)]
]

function completeChapter(store, chapterId, lessonIds) {
  let last = null
  for (const id of lessonIds) last = store.completeLesson(chapterId, id)
  return last
}

describe('learning store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.useRealTimers()
  })

  afterEach(() => vi.useRealTimers())

  it('默认解锁 ch-01，无进度，今日复习 0', () => {
    const s = useLearningStore()
    expect(s.unlocked).toEqual(['ch-01'])
    expect(s.progress).toEqual({})
    expect(s.todayReviewCount).toBe(0)
  })

  it('completeLesson 记录进度并持久化', () => {
    const s = useLearningStore()
    s.completeLesson('ch-01', L1[0])
    expect(s.progress['ch-01'][L1[0]]).toBe(true)
    expect(localStorage.getItem('tarot.learning.v1')).toBeTruthy()
  })

  it('完成整章后解锁下一章，且只解锁一章', () => {
    const s = useLearningStore()
    const r = completeChapter(s, 'ch-01', L1)
    expect(r.chapterCompleted).toBe(true)
    expect(r.chapterId).toBe('ch-01')
    expect(s.unlocked).toEqual(['ch-01', 'ch-02'])
    expect(s.unlocked).not.toContain('ch-03')
  })

  it('章节未完成时不解锁', () => {
    const s = useLearningStore()
    s.completeLesson('ch-01', L1[0])
    expect(s.unlocked).toEqual(['ch-01'])
  })

  it('ch-02 尚未解锁时不能完成其 lesson', () => {
    const s = useLearningStore()
    expect(() => s.completeLesson('ch-02', L2[0])).toThrow()
  })

  it('completeLesson 幂等：重复完成不报错、不重复解锁', () => {
    const s = useLearningStore()
    completeChapter(s, 'ch-01', L1)
    s.completeLesson('ch-01', L1[0]) // 重复
    expect(s.unlocked).toEqual(['ch-01', 'ch-02'])
  })

  it('已完成章节末课重玩不再重复发 XP（审查修复）', () => {
    const s = useLearningStore()
    completeChapter(s, 'ch-01', L1)
    const profile = useProfileStore()
    const before = profile.xp
    s.completeLesson('ch-01', L1[L1.length - 1]) // 重玩最后一课（此前每次 +50）
    expect(profile.xp).toBe(before)
  })

  it('reviewLog 持久化时只保留最近 90 个 dayKey（审查修复：防无限增长）', () => {
    const s = useLearningStore()
    s.reviewLog = Object.fromEntries(Array.from({ length: 95 }, (_, i) => [`d${String(i).padStart(3, '0')}`, 1]))
    s.recordReview()
    const saved = JSON.parse(localStorage.getItem('tarot.learning.v1')).reviewLog
    expect(Object.keys(saved).length).toBeLessThanOrEqual(90)
  })

  it('recordReview 累加今日复习数（走 currentDayKey）', () => {
    const s = useLearningStore()
    s.recordReview()
    s.recordReview()
    s.recordReview()
    expect(s.todayReviewCount).toBe(3)
  })

  it('新 store 从 localStorage 恢复进度与解锁', () => {
    const s = useLearningStore()
    completeChapter(s, 'ch-01', L1)
    s.recordReview()

    setActivePinia(createPinia())
    const s2 = useLearningStore()
    expect(s2.unlocked).toEqual(['ch-01', 'ch-02'])
    expect(s2.progress['ch-01'][L1[0]]).toBe(true)
    expect(s2.todayReviewCount).toBe(1)
  })

  it('localStorage 损坏时回退默认', () => {
    localStorage.setItem('tarot.learning.v1', '{bad')
    const s = useLearningStore()
    expect(s.unlocked).toEqual(['ch-01'])
    expect(s.progress).toEqual({})
  })

  it('章节完成度 getter', () => {
    const s = useLearningStore()
    s.completeLesson('ch-01', L1[0])
    expect(s.chapterDoneCount('ch-01')).toBe(1)
    expect(s.totalDoneCount).toBe(1)
  })

  it('rateCard 更新 SR 状态并计入今日复习', () => {
    const s = useLearningStore()
    s.rateCard('major-00', 'good')
    s.rateCard('major-00', 'again')
    const st = s.sr['major-00']
    expect(st.reps).toBe(0) // again 归零
    expect(s.todayReviewCount).toBe(2)
    // 已持久化
    const saved = JSON.parse(localStorage.getItem('tarot.learning.v1'))
    expect(saved.sr['major-00']).toBeTruthy()
  })

  it('dueFlashcards 只返回到期卡', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-25T12:00:00'))
    const s = useLearningStore()
    s.rateCard('major-00', 'good') // due +1 天
    // 用 fake 时间构造一张到期卡
    s.sr = { ...s.sr, 'major-01': { ease: 2.5, interval: 0, reps: 0, due: Date.now() - 1000 } }
    const due = s.dueFlashcards().map((c) => c.id)
    expect(due).toContain('major-01')
    expect(due).not.toContain('major-00')
    vi.useRealTimers()
  })

  it('毕业后 graduated 为 true 且不抛错（回归：箭头 getter 里 this 是 undefined）', () => {
    const s = useLearningStore()
    for (const [ch, ids] of ALL_CHAPTERS) completeChapter(s, ch, ids)
    expect(s.unlocked).toContain('ch-07')
    // 未毕业时 getter 因短路恰好返回 false；解锁 ch-07 后原实现求值 this._chapterComplete 必抛
    expect(s.graduated).toBe(true)
  })

  it('未毕业时 graduated 为 false', () => {
    const s = useLearningStore()
    expect(s.graduated).toBe(false)
  })
})
