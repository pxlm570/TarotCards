// 牌阵选择指引弹层（v1.5 追加）：选牌阵页「怎么选牌阵？」入口 + 底部弹层
// 分组/提问四原则/告诫条均渲染；数据契约（guide 三要素）由 data.spec 守卫，这里只管交互。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import SpreadSelectView from '../src/views/SpreadSelectView.vue'
import spreadsData from '../src/data/spreads.json'

vi.mock('../src/lib/feedback.js', () => ({ tap: vi.fn(), toast: vi.fn() }))
vi.mock('../src/composables/use-ritual-today.js', async () => {
  const { ref } = await import('vue')
  return {
    // 组件里 spreads 按普通数组用、ritualToday 按 ref 用（同真实 composable 的返回形态）
    useRitualToday: () => ({ ritualToday: ref(null), ritualSpread: ref(null), spreads: spreadsData })
  }
})
vi.mock('../src/lib/custom-spreads.js', () => ({
  listCustomSpreads: () => [],
  deleteCustomSpread: vi.fn()
}))

function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/reading/question', component: { template: '<div />' } },
      { path: '/spread-editor', component: { template: '<div />' } }
    ]
  })
  router.push = vi.fn()
  return mount(SpreadSelectView, { global: { plugins: [pinia, router] } })
}

describe('SpreadSelectView：牌阵选择指引弹层', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('点「怎么选牌阵？」打开弹层：标题、提问四原则、三组牌阵与告诫都在', async () => {
    const wrapper = mountPage()
    expect(wrapper.find('.guide-sheet').exists()).toBe(false)

    await wrapper.find('button.guide-entry').trigger('click')

    const sheet = wrapper.find('.guide-sheet')
    expect(sheet.exists()).toBe(true)
    expect(sheet.text()).toContain('牌阵怎么选')
    expect(sheet.text()).toContain('问得开放')
    expect(sheet.text()).toContain('聚焦当下')
    // 三个使用情境分组齐全，12 个牌阵的指引全部渲染
    const titles = wrapper.findAll('.guide-group-title').map((n) => n.text())
    expect(titles).toEqual(['日常与状态', '事件与抉择', '周期与仪式'])
    expect(wrapper.findAll('.guide-item')).toHaveLength(12)
    // 每个牌阵的指引来自数据层的 guide 字段（抽样两例）
    const single = spreadsData.find((s) => s.id === 'single')
    expect(sheet.text()).toContain(single.guide.fit)
    const celtic = spreadsData.find((s) => s.id === 'celtic-cross')
    expect(sheet.text()).toContain(celtic.guide.who)
    // 告诫条与自由摆放说明
    expect(sheet.text()).toContain('同一问题反复抽不会带来新信息')
    expect(sheet.text()).toContain('自由摆放')
  })

  it('点「明白了」或遮罩关闭弹层', async () => {
    const wrapper = mountPage()
    await wrapper.find('button.guide-entry').trigger('click')
    expect(wrapper.find('.guide-sheet').exists()).toBe(true)

    await wrapper.find('button.guide-close').trigger('click')
    expect(wrapper.find('.guide-sheet').exists()).toBe(false)
  })
})
