// 牌面大图灯箱（2026-09-02 用户需求）：详情页点牌面 → 全屏大图，点任意处/×/Esc 关闭。
// 数据与路由守卫归 data.spec / 路由层，这里只管开合交互与逆位旋转同步。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import CardDetailView from '../src/views/CardDetailView.vue'

vi.mock('../src/lib/feedback.js', () => ({ tap: vi.fn() }))
vi.mock('../src/lib/use-deck.js', () => ({
  // 测试里 manifest 不存在时真实实现返回 ''（骨架态），这里固定给一张图走亮图分支
  useDeck: () => ({ cardUrl: () => '/decks/rws/major-00.webp' })
}))
const { goBackMock } = vi.hoisted(() => ({ goBackMock: vi.fn() }))
vi.mock('../src/composables/use-back.js', () => ({ useBack: () => goBackMock }))

async function mountAt(path) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/deck/:cardId', component: CardDetailView },
      { path: '/deck', component: { template: '<div />' } }
    ]
  })
  router.push(path)
  await router.isReady()
  return mount(CardDetailView, { global: { plugins: [router] } })
}

describe('CardDetailView：牌面大图灯箱', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('点牌面打开全屏大图，点遮罩任意处关闭', async () => {
    const wrapper = await mountAt('/deck/major-00')
    expect(wrapper.find('.lightbox').exists()).toBe(false)

    await wrapper.find('.img-btn').trigger('click')

    const box = wrapper.find('.lightbox')
    expect(box.exists()).toBe(true)
    expect(wrapper.find('.lightbox-img').attributes('src')).toBe('/decks/rws/major-00.webp')
    expect(box.find('.lightbox-close').exists()).toBe(true)

    await wrapper.find('.lightbox').trigger('click')
    expect(wrapper.find('.lightbox').exists()).toBe(false)
  })

  it('切到逆位后打开大图，旋转状态同步', async () => {
    const wrapper = await mountAt('/deck/major-00')
    await wrapper.findAll('.seg')[1].trigger('click')
    await wrapper.find('.img-btn').trigger('click')

    expect(wrapper.find('.lightbox-img').classes()).toContain('reversed')
  })

  it('大图上有「点按查看大图」提示入口', async () => {
    const wrapper = await mountAt('/deck/major-00')
    expect(wrapper.find('.img-hint').text()).toContain('点按查看大图')
  })

  it('无效深链空态可返回牌库（goBack 兜底 /deck）', async () => {
    const wrapper = await mountAt('/deck/not-exist')
    expect(wrapper.find('.missing').exists()).toBe(true)

    await wrapper.find('.missing button').trigger('click')
    expect(goBackMock).toHaveBeenCalledWith('/deck')
  })
})
