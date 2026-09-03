// 闪卡复习会话快照（评审 2026-09-03）：评分会改 sr → due 列表实时收缩，若把实时列表
// 传给会话并以其拼 key，整场会话每评一张就 remount（进度归零、again 卡消失）。
// 修复后进页定格一次快照：评分不重建会话、进度累计。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import ReviewView from '../src/views/learn/ReviewView.vue'
import FlashcardSession from '../src/components/FlashcardSession.vue'
import { useLearningStore } from '../src/stores/learning.js'

vi.mock('../src/lib/feedback.js', () => ({ tap: vi.fn(), success: vi.fn(), toast: vi.fn() }))
vi.mock('../src/composables/use-back.js', () => ({ useBack: () => vi.fn() }))
vi.mock('../src/lib/use-deck.js', () => ({
  useDeck: () => ({ manifest: {}, cardUrl: () => '', backUrl: () => '' })
}))

async function mountReview() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const learning = useLearningStore()
  const due = Date.now() - 1000
  learning.sr = {
    'major-00': { ease: 2.5, interval: 0, reps: 0, due },
    'major-01': { ease: 2.5, interval: 0, reps: 0, due }
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/learn/review', component: ReviewView },
      { path: '/learn', component: { template: '<div />' } }
    ]
  })
  router.push('/learn/review')
  await router.isReady()
  const wrapper = mount(ReviewView, { global: { plugins: [pinia, router] } })
  return { wrapper, learning }
}

describe('ReviewView：闪卡会话不随评分重建', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('进页快照 due 列表，评分后同一会话实例继续、进度累计', async () => {
    const { wrapper, learning } = await mountReview()
    const session = wrapper.findComponent(FlashcardSession)
    expect(session.exists()).toBe(true)
    expect(session.text()).toContain('已复习 0 / 2')

    // 点「认识」：真实走 learning.rateCard（sr 变化 → 旧实现 due 列表收缩 → key 变 → remount）
    await session.findAll('.rate')[2].trigger('click')

    const after = wrapper.findComponent(FlashcardSession)
    expect(after.exists()).toBe(true)
    // 同一组件实例（uid 相同）：未 remount。不能比 wrapper 对象引用——findComponent 每次返回新包装
    expect(after.vm.$.uid).toBe(session.vm.$.uid)
    expect(after.text()).toContain('已复习 1 / 2')
    expect(learning.todayReviewCount).toBe(1)
  })

  it('全部评完显示完成态', async () => {
    const { wrapper } = await mountReview()
    const session = wrapper.findComponent(FlashcardSession)
    await session.findAll('.rate')[2].trigger('click')
    const s2 = wrapper.findComponent(FlashcardSession)
    await s2.findAll('.rate')[2].trigger('click')
    expect(wrapper.text()).toContain('本组闪卡复习完成')
  })
})
