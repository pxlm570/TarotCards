// 课程数据契约（M2 Task 1）：7 章结构合法、引用存在、正文全中文无英文混排。
import { describe, it, expect } from 'vitest'
import chapters from '../src/data/courses/index.json'
import ch01 from '../src/data/courses/chapter-01.json'
import ch02 from '../src/data/courses/chapter-02.json'
import ch03 from '../src/data/courses/chapter-03.json'
import ch04 from '../src/data/courses/chapter-04.json'
import ch05 from '../src/data/courses/chapter-05.json'
import ch06 from '../src/data/courses/chapter-06.json'
import ch07 from '../src/data/courses/chapter-07.json'
import cards from '../src/data/cards.json'
import spreads from '../src/data/spreads.json'

const CARD_IDS = new Set(cards.map((c) => c.id))
const SPREAD_IDS = new Set(spreads.map((s) => s.id))
const TYPES = ['article', 'flashcards', 'quiz', 'practice']
const BLOCK_TYPES = ['heading', 'paragraph', 'card-ref', 'list']

const CHAPTERS = { ch01, ch02, ch03, ch04, ch05, ch06, ch07 }
const ORDERED = chapters.map((c) => c.id)

function loadChapter(id) {
  const key = `ch${String(ORDERED.indexOf(id) + 1).padStart(2, '0')}`
  return CHAPTERS[key]
}

describe('courses 索引', () => {
  it('恰好 7 章，id 唯一且文件可读', () => {
    expect(chapters).toHaveLength(7)
    const ids = chapters.map((c) => c.id)
    expect(new Set(ids).size).toBe(7)
    for (const c of chapters) {
      expect(loadChapter(c.id).id, c.id).toBe(c.id)
    }
  })

  it('章节字段完整，order 连续 1-7', () => {
    chapters.forEach((c, i) => {
      expect(c.order, c.id).toBe(i + 1)
      expect(c.title.trim(), c.id).toBeTruthy()
      expect(c.intro.trim(), c.id).toBeTruthy()
    })
  })
})

describe('章节结构', () => {
  for (const ch of chapters) {
    describe(ch.id, () => {
      const data = loadChapter(ch.id)
      const lessons = data.lessons

      it('至少 3 个 lesson，id 前缀正确且唯一', () => {
        expect(lessons.length).toBeGreaterThanOrEqual(3)
        const ids = new Set()
        for (const l of lessons) {
          expect(l.id, l.title).toMatch(new RegExp(`^${ch.id}-l\\d+$`))
          expect(ids.has(l.id), `${l.id} 重复`).toBe(false)
          ids.add(l.id)
        }
      })

      it('每个 lesson 类型合法且 title 非空', () => {
        for (const l of lessons) {
          expect(TYPES, l.id).toContain(l.type)
          expect(l.title.trim(), l.id).toBeTruthy()
        }
      })

      it('article 的 blocks 结构合法', () => {
        for (const l of lessons.filter((x) => x.type === 'article')) {
          expect(Array.isArray(l.blocks) && l.blocks.length > 0, `${l.id} blocks`).toBe(true)
          for (const b of l.blocks) {
            expect(BLOCK_TYPES, `${l.id} block`).toContain(b.type)
            if (b.type === 'heading' || b.type === 'paragraph') {
              expect(b.text.trim(), `${l.id} ${b.type}`).toBeTruthy()
            } else if (b.type === 'card-ref') {
              expect(CARD_IDS.has(b.cardId), `${l.id} card-ref ${b.cardId}`).toBe(true)
            } else if (b.type === 'list') {
              expect(Array.isArray(b.items) && b.items.length > 0, `${l.id} list`).toBe(true)
              b.items.forEach((s) => expect(s.trim(), `${l.id} list 项`).toBeTruthy())
            }
          }
        }
      })

      it('flashcards 的 cardIds 均存在于 cards.json', () => {
        for (const l of lessons.filter((x) => x.type === 'flashcards')) {
          expect(Array.isArray(l.cardIds) && l.cardIds.length > 0, `${l.id} cardIds`).toBe(true)
          l.cardIds.forEach((id) => expect(CARD_IDS.has(id), `${l.id} ${id}`).toBe(true))
        }
      })

      it('quiz 每题选项与 answer 下标合法（含 multi/image/orientation）', () => {
        for (const l of lessons.filter((x) => x.type === 'quiz')) {
          expect(Array.isArray(l.questions) && l.questions.length > 0, `${l.id} questions`).toBe(true)
          for (const q of l.questions) {
            expect(q.q.trim(), `${l.id} q`).toBeTruthy()
            expect(Array.isArray(q.options) && q.options.length >= 2, `${l.id} options`).toBe(true)
            const type = q.type ?? 'single'
            expect(['single', 'multi', 'image', 'orientation'], `${l.id} type`).toContain(type)
            if (type === 'multi') {
              expect(Array.isArray(q.answer) && q.answer.length >= 1, `${l.id} multi answer`).toBe(true)
              q.answer.forEach((a) =>
                expect(Number.isInteger(a) && a >= 0 && a < q.options.length, `${l.id} answer idx`).toBe(true)
              )
            } else {
              expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${l.id} answer`).toBe(true)
            }
            if (type === 'image' || type === 'orientation') {
              expect(CARD_IDS.has(q.cardId), `${l.id} cardId`).toBe(true)
            }
            expect(q.explain.trim(), `${l.id} explain`).toBeTruthy()
          }
        }
      })

      it('practice 的 spreadId 存在', () => {
        for (const l of lessons.filter((x) => x.type === 'practice')) {
          expect(SPREAD_IDS.has(l.spreadId), `${l.id} spreadId`).toBe(true)
          expect(l.task.trim(), `${l.id} task`).toBeTruthy()
        }
      })

      it('正文全中文，无英文混排（card-ref/cardIds/spreadId 除外）', () => {
        const texts = []
        texts.push(data.title, data.intro)
        for (const l of lessons) {
          texts.push(l.title)
          if (l.type === 'article') {
            for (const b of l.blocks) {
              if (b.type === 'heading' || b.type === 'paragraph') texts.push(b.text)
              else if (b.type === 'list') texts.push(...b.items)
            }
          } else if (l.type === 'quiz') {
            for (const q of l.questions) texts.push(q.q, ...q.options, q.explain)
          } else if (l.type === 'practice') {
            texts.push(l.task)
          }
        }
        for (const t of texts) {
          expect(t.trim(), `${ch.id} 空文案`).toBeTruthy()
          expect(t, `${ch.id} 英文混排: ${t}`).not.toMatch(/[a-zA-Z]/)
        }
      })
    })
  }
})
