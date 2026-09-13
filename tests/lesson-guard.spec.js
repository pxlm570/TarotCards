// 课时深链解锁门（评审 2026-09-06）：LessonView 曾不校验章节解锁——未解锁章节的
// 完成动作会炸在 completeLesson（throw 无捕获），闪卡课更会卡死在最后一张。
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import LessonView from '../src/views/learn/LessonView.vue'
import { useLearningStore } from '../src/stores/learning.js'
import ch03 from '../src/data/courses/chapter-03.json'

async function mountAt(path, setup) {
  const pinia = createPinia()
  setActivePinia(pinia)
  setup?.()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/learn/:chapterId/:lessonId', component: LessonView },
      { path: '/learn/:chapterId', component: { template: '<div />' } },
      { path: '/deck/:cardId', component: { template: '<div />' } }
    ]
  })
  router.push(path)
  await router.isReady()
  return mount(LessonView, { global: { plugins: [pinia, router] } })
}

describe('LessonView：章节解锁门', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('未解锁章节的课时深链显示锁定态，不渲染课时内容', async () => {
    const wrapper = await mountAt(`/learn/ch-03/${ch03.lessons[0].id}`)
    expect(wrapper.find('.locked').exists()).toBe(true)
    expect(wrapper.text()).toContain('完成前一章所有课程后解锁')
    expect(wrapper.find('article, .lesson-body, .quiz, .flashcard').exists()).toBe(false)
  })

  it('无效课时深链仍走「找不到这一课」空态', async () => {
    const wrapper = await mountAt('/learn/ch-03/not-exist-lesson')
    expect(wrapper.find('.missing').exists()).toBe(true)
  })

  it('已解锁章节正常渲染课时内容', async () => {
    const wrapper = await mountAt(`/learn/ch-03/${ch03.lessons[0].id}`, () => {
      useLearningStore().$patch({ unlocked: ['ch-01', 'ch-02', 'ch-03'] })
    })
    expect(wrapper.find('.locked').exists()).toBe(false)
    expect(wrapper.text()).toContain(ch03.lessons[0].title)
  })
})
