// FlowExit 分支覆盖（v1.5 Task 3 / v1.0 验收遗留 #14）：动线五页统一退出入口，
// 守着三条资产安全分支--beforeExit 草稿确认、confirm 整局作废确认、reset=false 不误伤进行中的一局。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import FlowExit from '../src/components/FlowExit.vue'
import { useReadingStore } from '../src/stores/reading.js'
import { tap } from '../src/lib/feedback.js'

vi.mock('../src/lib/feedback.js', () => ({ tap: vi.fn() }))

function mountExit(props = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }]
  })
  router.replace = vi.fn()
  const wrapper = mount(FlowExit, { props, global: { plugins: [pinia, router] } })
  const store = useReadingStore(pinia)
  return { wrapper, router, store }
}

function clickExit(wrapper) {
  return wrapper.find('button.flow-exit').trigger('click')
}

describe('FlowExit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // isolate:false 共享 worker：显式归零 history.state，别让别的用例写过的状态串进来
    Object.defineProperty(window.history, 'state', { value: null, configurable: true })
  })

  it('confirm=true（中途）：确认弹「本局作废」，取消则不退出不动 store', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { wrapper, router, store } = mountExit()
    const resetSpy = vi.spyOn(store, 'reset')
    await clickExit(wrapper)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy).toHaveBeenCalledWith('退出后本局作废，确定吗？')
    expect(router.replace).not.toHaveBeenCalled()
    expect(resetSpy).not.toHaveBeenCalled()
  })

  it('confirm=true 且用户确认：tap + reset + 回首页', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { wrapper, router, store } = mountExit()
    const resetSpy = vi.spyOn(store, 'reset')
    await clickExit(wrapper)
    expect(router.replace).toHaveBeenCalledWith('/')
    expect(resetSpy).toHaveBeenCalledTimes(1)
    expect(tap).toHaveBeenCalled()
  })

  it('confirm=false（解读页形态）：免确认直退', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { wrapper, router, store } = mountExit({ confirm: false })
    const resetSpy = vi.spyOn(store, 'reset')
    await clickExit(wrapper)
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalledWith('/')
    expect(resetSpy).toHaveBeenCalledTimes(1)
  })

  it('beforeExit 有草稿：先弹草稿确认，草稿取消则整局作废确认根本不出现', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { wrapper, router } = mountExit({ beforeExit: () => true })
    await clickExit(wrapper)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy).toHaveBeenCalledWith(
      '你写下的感想/练习理解还没有保存，退出将丢失它们。确定吗？'
    )
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('beforeExit 草稿确认通过后，仍要走整局作废确认（confirm=true）', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(false)
    const { wrapper, router } = mountExit({ beforeExit: () => true })
    await clickExit(wrapper)
    expect(confirmSpy).toHaveBeenCalledTimes(2)
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('reset=false（/spreads 复用形态）：退出但不作废进行中的一局', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { wrapper, router, store } = mountExit({ confirm: false, reset: false })
    const resetSpy = vi.spyOn(store, 'reset')
    await clickExit(wrapper)
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalledWith('/')
    expect(resetSpy).not.toHaveBeenCalled()
  })

  // ---- 「从哪进、退回哪」（2026-08-31）新增三形态 ----

  function stubHistoryState(value) {
    Object.defineProperty(window.history, 'state', { value, configurable: true })
  }

  it('to 参数（占卜动线）：退出 replace 回显式入口页（store.entryPath）', async () => {
    stubHistoryState(null)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { wrapper, router } = mountExit({ confirm: false, to: '/spreads' })
    await clickExit(wrapper)
    expect(router.replace).toHaveBeenCalledWith('/spreads')
  })

  it('无 to：站内进入（有来源页）走 back() 回来源页', async () => {
    stubHistoryState({ back: '/profile', position: 2 })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { wrapper, router } = mountExit({ confirm: false, reset: false })
    router.back = vi.fn()
    await clickExit(wrapper)
    expect(router.back).toHaveBeenCalledTimes(1)
    expect(router.replace).not.toHaveBeenCalled()
    stubHistoryState(null)
  })

  it('无 to：直链进入（无历史）replace 回 fallback 兜底页', async () => {
    stubHistoryState(null)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { wrapper, router } = mountExit({ confirm: false, reset: false, fallback: '/deck' })
    await clickExit(wrapper)
    expect(router.replace).toHaveBeenCalledWith('/deck')
  })
})
