import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ArticleLesson from '../src/views/learn/ArticleLesson.vue'
import QuizLesson from '../src/views/learn/QuizLesson.vue'
import { useLearningStore } from '../src/stores/learning.js'
import chapter from '../src/data/courses/chapter-01.json'

let wrapper
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActivePinia(createPinia()) })
afterEach(() => wrapper?.unmount())
describe('图文小课学习闭环', () => {
  it('看完知识步骤后答错不会完成，答对且确认才保存学习进度', async () => {
    const lesson = chapter.lessons[0]
    wrapper = mount(ArticleLesson, { props: { blocks: lesson.blocks, chapterId: chapter.id, lessonId: lesson.id }, global: { stubs: { LessonIllustration: true } } })
    const store = useLearningStore()
    expect(wrapper.text()).toContain('先看一眼')
    for (let n = 0; n < 20 && !wrapper.find('.choices').exists(); n++) await wrapper.get('.step-actions .btn-solid').trigger('click')
    expect(wrapper.find('.choices').exists()).toBe(true)
    expect(store.progress[chapter.id]?.[lesson.id]).toBeUndefined()
    await wrapper.findAll('.choice')[0].trigger('click')
    await wrapper.get('.step-actions .btn-solid').trigger('click')
    expect(wrapper.text()).toContain('再想一想')
    expect(store.progress[chapter.id]?.[lesson.id]).toBeUndefined()
    await wrapper.findAll('.choice')[1].trigger('click')
    await wrapper.get('.step-actions .btn-solid').trigger('click')
    expect(wrapper.text()).toContain('答对了')
    expect(store.progress[chapter.id]?.[lesson.id]).toBeUndefined()
    await wrapper.get('.step-actions .btn-solid').trigger('click')
    expect(store.progress[chapter.id][lesson.id]).toBe(true)
    expect(wrapper.text()).toContain('又看懂了一点')
  })
  it('测验答对先展示解释，点继续才推进，最后一题不提前完成', async () => {
    const lesson = chapter.lessons.find((l) => l.type === 'quiz')
    wrapper = mount(QuizLesson, { props: { chapterId: chapter.id, lessonId: lesson.id, questions: lesson.questions } })
    for (const q of lesson.questions) {
      await wrapper.findAll('.opt')[q.answer].trigger('click')
      expect(wrapper.get('.correct-feedback').text()).toContain(q.explain)
      expect(wrapper.find('.done').exists()).toBe(false)
      await wrapper.get('.correct-feedback button').trigger('click')
    }
    expect(useLearningStore().progress[chapter.id][lesson.id]).toBe(true)
    expect(wrapper.get('.fill').attributes('style')).toContain('100%')
  })
})
