// 「我的」页内联本命牌（2026-09-03 用户反馈）：重设进编辑态可退出（误触保护），展示居中。
// store 持久化归 profile.spec，这里只管双态交互。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import ProfileView from '../src/views/ProfileView.vue'
import { useProfileStore } from '../src/stores/profile.js'

vi.mock('../src/lib/feedback.js', () => ({
  tap: vi.fn(),
  success: vi.fn(),
  toast: vi.fn(),
  toasts: [],
  TOAST_MS: 2200,
  prefersReducedMotion: () => false,
  applyMotionPreference: vi.fn(),
  scrollBehavior: vi.fn()
}))
vi.mock('../src/lib/use-deck.js', () => ({
  useDeck: () => ({ cardUrl: () => '/decks/rws/major-00.webp' })
}))

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/profile', component: ProfileView },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } }
    ]
  })
  router.push('/profile')
  await router.isReady()
  return mount(ProfileView, { global: { plugins: [router] } })
}

describe('ProfileView：内联本命牌', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('无生日：输入表单且无退出按钮', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('.birth-lead').exists()).toBe(true)
    expect(wrapper.find('.birth-cancel').exists()).toBe(false)
  })

  it('重设进编辑态不清数据，退出回到原展示', async () => {
    const wrapper = await mountView()
    const store = useProfileStore()
    store.setBirthday('1995-06-15')
    await nextTick()
    await wrapper.find('.reset').trigger('click')

    // 编辑态：表单 + 退出按钮，原生日未被清掉
    expect(wrapper.find('.birth-lead').exists()).toBe(true)
    expect(wrapper.find('.birth-cancel').exists()).toBe(true)
    expect(store.birthday).toBe('1995-06-15')

    await wrapper.find('.birth-cancel').trigger('click')
    expect(wrapper.find('.birth-row').exists()).toBe(true)
    expect(wrapper.find('.reset').exists()).toBe(true)
    expect(store.birthday).toBe('1995-06-15')
  })

  it('编辑态保存新日期后回到展示态', async () => {
    const wrapper = await mountView()
    const store = useProfileStore()
    store.setBirthday('1995-06-15')
    await nextTick()
    await wrapper.find('.reset').trigger('click')

    await wrapper.find('.birth-input').setValue('1990-05-23')
    await wrapper.find('.birth-save').trigger('click')

    expect(store.birthday).toBe('1990-05-23')
    expect(wrapper.find('.birth-row').exists()).toBe(true)
    expect(wrapper.find('.birth-cancel').exists()).toBe(false)
  })
})
