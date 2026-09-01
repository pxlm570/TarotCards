// 智能返回（2026-08-31「从哪进、退回哪」页面规划管理）：
// 站内 push 进入（history.state.back 存在）→ router.back() 自然回退；
// 直链/刷新进入（无 back）→ replace 回兜底页，不产生死胡同。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useBack } from '../src/composables/use-back.js'

vi.mock('../src/lib/feedback.js', () => ({ tap: vi.fn() }))

// 挂一个宿主组件拿 goBack 句柄
const Host = defineComponent({
  props: { fallback: { type: String, default: '/' } },
  setup(props) {
    const goBack = useBack()
    return () => h('button', { onClick: () => goBack(props.fallback) })
  }
})

async function mountHost() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }]
  })
  await router.push('/')
  await router.isReady()
  router.back = vi.fn()
  router.replace = vi.fn()
  const wrapper = mount(Host, { props: { fallback: '/deck' }, global: { plugins: [pinia, router] } })
  return { wrapper, router }
}

// jsdom 的 history.state 默认 null；用例内覆写、afterEach 还原，防 isolate:false 串味
function stubHistoryState(value) {
  Object.defineProperty(window.history, 'state', { value, configurable: true })
}

describe('useBack：统一返回语义', () => {
  beforeEach(() => stubHistoryState(null))
  afterEach(() => stubHistoryState(null))

  it('站内进入（有来源页）→ router.back() 回来源页', async () => {
    stubHistoryState({ back: '/profile', position: 2 })
    const { wrapper, router } = await mountHost()
    await wrapper.find('button').trigger('click')
    expect(router.back).toHaveBeenCalledTimes(1)
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('直链/刷新进入（无历史）→ replace 回兜底页，不留死胡同', async () => {
    const { wrapper, router } = await mountHost()
    await wrapper.find('button').trigger('click')
    expect(router.replace).toHaveBeenCalledWith('/deck')
    expect(router.back).not.toHaveBeenCalled()
  })

  it('fallback 缺省为首页', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }]
    })
    await router.push('/')
    await router.isReady()
    router.replace = vi.fn()
    const wrapper = mount(Host, { global: { plugins: [pinia, router] } }) // 不传 fallback
    await wrapper.find('button').trigger('click')
    expect(router.replace).toHaveBeenCalledWith('/')
  })
})
