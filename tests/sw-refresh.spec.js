// 部署后自动刷新到新版（2026-07-27 用户报「打开还是原来的样子」后加的根治）
import { describe, it, expect, vi } from 'vitest'
import { setupUpdateReload } from '../src/lib/sw-refresh.js'

// 假的 navigator.serviceWorker：只需要 controller + 事件派发
function fakeContainer(controller) {
  const listeners = []
  return {
    controller,
    addEventListener: (type, fn) => type === 'controllerchange' && listeners.push(fn),
    fireControllerChange: () => listeners.forEach((fn) => fn())
  }
}

describe('sw-refresh：新版接管时自动刷新', () => {
  it('老用户（已有 SW 接管）换人时刷新一次', () => {
    const reload = vi.fn()
    const sw = fakeContainer({})
    setupUpdateReload({ container: sw, reload, isTyping: () => false })

    sw.fireControllerChange()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('首次安装（controller 为 null）不刷新——否则新用户白刷一次', () => {
    const reload = vi.fn()
    const sw = fakeContainer(null)
    setupUpdateReload({ container: sw, reload, isTyping: () => false })

    sw.fireControllerChange()
    expect(reload).not.toHaveBeenCalled()
  })

  it('连续触发只刷一次，杜绝刷新循环', () => {
    const reload = vi.fn()
    const sw = fakeContainer({})
    setupUpdateReload({ container: sw, reload, isTyping: () => false })

    sw.fireControllerChange()
    sw.fireControllerChange()
    sw.fireControllerChange()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('用户正在输入时不刷新（未保存的问题/感想不能被刷没）', () => {
    const reload = vi.fn()
    const sw = fakeContainer({})
    let typing = true
    setupUpdateReload({ container: sw, reload, isTyping: () => typing })

    sw.fireControllerChange()
    expect(reload).not.toHaveBeenCalled()

    // 输入结束后再有接管变化，仍然应该能刷（跳过不消耗"只刷一次"的额度）
    typing = false
    sw.fireControllerChange()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('默认 isTyping 认得输入框', () => {
    const reload = vi.fn()
    const sw = fakeContainer({})
    setupUpdateReload({ container: sw, reload })

    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    ta.focus()
    sw.fireControllerChange()
    expect(reload).not.toHaveBeenCalled()

    ta.blur()
    ta.remove()
    sw.fireControllerChange()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('宿主不支持 serviceWorker 时静默跳过', () => {
    expect(setupUpdateReload({ container: undefined })).toBe(false)
    expect(() => setupUpdateReload({ container: {} })).not.toThrow()
  })
})
