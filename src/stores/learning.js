// 学习进度与闯关解锁 store（M2 Task 3）。
// 章节所有 lesson 完成 → 解锁下一章；当日复习计数供 M3 今日小目标使用。
// 持久化 tarot.learning.v1。
import { defineStore } from 'pinia'
import chapters from '../data/courses/index.json'
import ch01 from '../data/courses/chapter-01.json'
import ch02 from '../data/courses/chapter-02.json'
import ch03 from '../data/courses/chapter-03.json'
import ch04 from '../data/courses/chapter-04.json'
import ch05 from '../data/courses/chapter-05.json'
import ch06 from '../data/courses/chapter-06.json'
import ch07 from '../data/courses/chapter-07.json'
import { currentDayKey } from '../lib/day-key.js'
import { newCard, review, dueCards } from '../lib/spaced-repetition.js'
import { safeGetItem, safeSetItem } from '../lib/storage.js'

const KEY = 'tarot.learning.v1'

// 章节 id → lesson id 列表（用于判断「整章完成」）
const CHAPTER_LESSONS = {
  'ch-01': ch01.lessons.map((l) => l.id),
  'ch-02': ch02.lessons.map((l) => l.id),
  'ch-03': ch03.lessons.map((l) => l.id),
  'ch-04': ch04.lessons.map((l) => l.id),
  'ch-05': ch05.lessons.map((l) => l.id),
  'ch-06': ch06.lessons.map((l) => l.id),
  'ch-07': ch07.lessons.map((l) => l.id)
}
const CHAPTER_ORDER = chapters.map((c) => c.id)

function initialState() {
  return {
    progress: {}, // { [chapterId]: { [lessonId]: true } }
    unlocked: ['ch-01'],
    reviewLog: {}, // { [dayKey]: count }
    sr: {} // { [cardId]: { ease, interval, due, reps } } 闪卡间隔重复状态
  }
}

function parseSaved() {
  const raw = safeGetItem(KEY)
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object' && Array.isArray(p.unlocked) && p.progress) return p
    return null
  } catch {
    return null
  }
}

export const useLearningStore = defineStore('learning', {
  state: () => ({ ...initialState(), ...(parseSaved() ?? {}) }),

  getters: {
    todayReviewCount: (s) => s.reviewLog[currentDayKey()] || 0,
    totalDoneCount: (s) => Object.values(s.progress).reduce((n, m) => n + Object.keys(m).length, 0),
    totalLessonCount: () => Object.values(CHAPTER_LESSONS).reduce((n, arr) => n + arr.length, 0),
    graduated: (s) => s.unlocked.includes('ch-07') && this._chapterComplete('ch-07')
  },

  actions: {
    _chapterComplete(chapterId) {
      const done = this.progress[chapterId] ?? {}
      return CHAPTER_LESSONS[chapterId].every((id) => done[id])
    },

    chapterDoneCount(chapterId) {
      return Object.keys(this.progress[chapterId] ?? {}).length
    },

    isChapterComplete(chapterId) {
      return this._chapterComplete(chapterId)
    },

    // 完成一个 lesson；整章完成则解锁下一章。返回 { chapterCompleted, chapterId }
    completeLesson(chapterId, lessonId) {
      if (!CHAPTER_LESSONS[chapterId]) throw new Error(`[learning] 未知章节：${chapterId}`)
      if (!this.unlocked.includes(chapterId)) {
        throw new Error(`[learning] 章节 ${chapterId} 尚未解锁`)
      }
      if (!CHAPTER_LESSONS[chapterId].includes(lessonId)) {
        throw new Error(`[learning] 未知 lesson：${lessonId}`)
      }
      this.progress = { ...this.progress, [chapterId]: { ...(this.progress[chapterId] ?? {}), [lessonId]: true } }

      const chapterCompleted = this._chapterComplete(chapterId)
      if (chapterCompleted) {
        const idx = CHAPTER_ORDER.indexOf(chapterId)
        const nextId = CHAPTER_ORDER[idx + 1]
        if (nextId && !this.unlocked.includes(nextId)) {
          this.unlocked = [...this.unlocked, nextId]
        }
      }
      this._persist()
      return { chapterCompleted, chapterId }
    },

    // 记录一次闪卡复习（当日累计，供今日小目标）
    recordReview() {
      const key = currentDayKey()
      this.reviewLog = { ...this.reviewLog, [key]: (this.reviewLog[key] || 0) + 1 }
      this._persist()
      return this.reviewLog[key]
    },

    // 给一张闪卡打分（三档），更新 SR 状态并计入今日复习
    rateCard(cardId, rating) {
      const prev = this.sr[cardId] ?? newCard()
      this.sr = { ...this.sr, [cardId]: review(prev, rating) }
      this.recordReview()
      return this.sr[cardId]
    },

    // 已到期的闪卡（复习入口）
    dueFlashcards() {
      return dueCards(
        Object.entries(this.sr).map(([id, st]) => ({ id, ...st })),
        Date.now()
      )
    },

    reset() {
      Object.assign(this, initialState())
      this._clear()
    },

    _persist() {
      safeSetItem(KEY, JSON.stringify({ progress: this.progress, unlocked: this.unlocked, reviewLog: this.reviewLog, sr: this.sr }))
    },
    _clear() {
      try {
        localStorage.removeItem(KEY)
      } catch {
        /* ignore */
      }
    }
  }
})
