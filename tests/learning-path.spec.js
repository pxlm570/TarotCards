import { describe, expect, it } from 'vitest'
import { chapters, nextLesson, articleSteps, LESSON_LABELS, CHAPTER_CARDS } from '../src/lib/learning-path.js'
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
    expect(nextLesson({}, [])).toBeNull() // 一个章节都没解锁：无路可走，不许兜底到第一章
  })
  it('短步骤保留正文与列表，不因原始课文只有一个标题而塞进同一屏', () => {
    const steps = articleSteps([{ type: 'heading', text: '标题' }, { type: 'paragraph', text: '一' },
      { type: 'paragraph', text: '二' }, { type: 'list', items: ['甲', '乙'] }])
    expect(steps).toHaveLength(3)
    expect(steps.every((s) => s.title === '标题')).toBe(true)
    expect(steps[2].block.items).toEqual(['甲', '乙'])
  })
  it('card-ref 之后段落继承引用牌；新 heading 重置引用；块级显式 cards 优先于引用', () => {
    const steps = articleSteps([
      { type: 'heading', text: '第一节' },
      { type: 'card-ref', cardId: 'major-00' },
      { type: 'paragraph', text: '沿用引用' },
      { type: 'paragraph', text: '自带配图', cards: ['major-07'] },
      { type: 'heading', text: '第二节' },
      { type: 'paragraph', text: '引用已重置' }
    ])
    expect(steps).toHaveLength(3)
    expect(steps[0].cards).toEqual([{ cardId: 'major-00', caption: '愚人' }])
    expect(steps[1].cards).toEqual([{ cardId: 'major-07', caption: '战车' }])
    expect(steps[2].cards).toEqual([])
  })
  it('caption 取注册表牌名，逆位追加「 · 逆位」；对象形态保留 reversed 等字段', () => {
    const steps = articleSteps([
      { type: 'heading', text: '牌义' },
      { type: 'paragraph', text: '一', cards: [{ cardId: 'wands-01', reversed: true }, 'cups-13'] }
    ])
    expect(steps[0].cards[0]).toEqual({ cardId: 'wands-01', reversed: true, caption: '权杖王牌 · 逆位' })
    expect(steps[0].cards[1]).toEqual({ cardId: 'cups-13', caption: '圣杯王后' })
  })
  it('章节配图契约：CHAPTER_CARDS 与章节数量一致且都是真实牌（写错即章卡图裂）', () => {
    expect(CHAPTER_CARDS).toHaveLength(chapters.length)
    for (const id of CHAPTER_CARDS) expect(cards.some((c) => c.id === id), id).toBe(true)
  })
  it('课时类型标签契约：数据里出现的每种课时类型都有中文标签', () => {
    const types = [...new Set(chapters.flatMap((c) => c.lessons.map((l) => l.type)))]
    expect(types.length).toBeGreaterThan(0)
    for (const type of types) expect(LESSON_LABELS[type]?.trim(), type).toBeTruthy()
  })
})
