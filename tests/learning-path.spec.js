import { describe, expect, it } from 'vitest'
import { chapters, nextLesson, articleSteps } from '../src/lib/learning-path.js'
import activities from '../src/data/lesson-activities.json'
import cards from '../src/data/cards.json'

describe('图文课程与学习路径', () => {
  it('全部图文课都有真实牌面、观察提示与有效的小练习', () => {
    const articles = chapters.flatMap((c) => c.lessons).filter((l) => l.type === 'article')
    expect(articles).toHaveLength(20)
    expect(Object.keys(activities).sort()).toEqual(articles.map((l) => l.id).sort())
    for (const lesson of articles) {
      const activity = activities[lesson.id]
      expect(activity.cards.length, lesson.id).toBeGreaterThan(0)
      for (const image of activity.cards) {
        expect(cards.some((c) => c.id === image.cardId), lesson.id).toBe(true)
        expect(image.caption.trim()).toBeTruthy()
      }
      expect(activity.observe.trim()).toBeTruthy()
      expect(activity.question.options.length).toBeGreaterThanOrEqual(2)
      expect(activity.question.answer).toBeGreaterThanOrEqual(0)
      expect(activity.question.answer).toBeLessThan(activity.question.options.length)
      expect(activity.question.explanation.trim()).toBeTruthy()
      expect(articleSteps(lesson.blocks).length).toBeGreaterThan(0)
      for (const block of lesson.blocks.filter((b) => ['paragraph', 'list'].includes(b.type))) {
        expect(Array.isArray(block.cards), `${lesson.id} 必须显式声明步骤配图（无适合素材用空数组）`).toBe(true)
        for (const value of block.cards) expect(cards.some((c) => c.id === (typeof value === 'string' ? value : value.cardId))).toBe(true)
      }
    }
  })
  it('继续学习跳过已完成课时，且不进入未解锁章节', () => {
    expect(nextLesson({}, ['ch-01']).lesson.id).toBe('ch-01-l1')
    const done = Object.fromEntries(chapters[0].lessons.map((l) => [l.id, true]))
    expect(nextLesson({ 'ch-01': done }, ['ch-01'])).toBeNull()
    expect(nextLesson({ 'ch-01': done }, ['ch-01', 'ch-02']).lesson.id).toBe('ch-02-l1')
  })
  it('短步骤保留正文与列表，不因原始课文只有一个标题而塞进同一屏', () => {
    const steps = articleSteps([{ type: 'heading', text: '标题' }, { type: 'paragraph', text: '一' },
      { type: 'paragraph', text: '二' }, { type: 'list', items: ['甲', '乙'] }])
    expect(steps).toHaveLength(3)
    expect(steps.every((s) => s.title === '标题')).toBe(true)
    expect(steps[2].block.items).toEqual(['甲', '乙'])
  })
})
