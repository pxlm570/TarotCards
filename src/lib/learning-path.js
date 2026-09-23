// 课程导航同源：保留原有课时 ID 与进度，展示层按已解锁、未完成寻找下一步。
import ch01 from '../data/courses/chapter-01.json'
import ch02 from '../data/courses/chapter-02.json'
import ch03 from '../data/courses/chapter-03.json'
import ch04 from '../data/courses/chapter-04.json'
import ch05 from '../data/courses/chapter-05.json'
import ch06 from '../data/courses/chapter-06.json'
import ch07 from '../data/courses/chapter-07.json'
import cardsData from '../data/cards.json'

export const chapters = [ch01, ch02, ch03, ch04, ch05, ch06, ch07]
export const LESSON_LABELS = { article: '看图学一课', flashcards: '翻牌记一记', quiz: '挑战小测验', practice: '动手试一局' }
export const CHAPTER_CARDS = ['major-00', 'major-07', 'wands-01', 'cups-13', 'major-10', 'major-01', 'major-21']

export function nextLesson(progress, unlocked) {
  for (const chapter of chapters) {
    if (!unlocked.includes(chapter.id)) continue
    const lesson = chapter.lessons.find((l) => !progress[chapter.id]?.[l.id])
    if (lesson) return { chapter, lesson, path: `/learn/${chapter.id}/${lesson.id}` }
  }
  return null
}

export function articleSteps(blocks) {
  let title = '看懂这张牌'
  let reference = []
  const names = new Map(cardsData.map((c) => [c.id, c.name]))
  return blocks.flatMap((block) => {
    if (block.type === 'heading') { title = block.text; reference = []; return [] }
    if (block.type === 'card-ref') { reference = [block.cardId]; return [] }
    const cards = (block.cards ?? reference).map((value) => {
      const card = typeof value === 'string' ? { cardId: value } : value
      return { ...card, caption: `${names.get(card.cardId)}${card.reversed ? ' · 逆位' : ''}` }
    })
    return [{ title, block, cards }]
  })
}
