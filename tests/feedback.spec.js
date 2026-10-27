// 反馈体系（M1.5 Task 4.5）：触感统一封装、轻提示队列、动效降级判定
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  tap,
  success,
  toast,
  toasts,
  TOAST_MS,
  prefersReducedMotion,
  applyMotionPreference,
  scrollBehavior
} from '../src/lib/feedback.js'
import { saveSettings } from '../src/lib/storage.js'

function stubVibrate() {
  const fn = vi.fn()
  Object.defineProperty(navigator, 'vibrate', { value: fn, configurable: true, writable: true })
  return fn
}

function stubReduceMotion(reduce) {
  window.matchMedia = vi.fn(() => ({
    matches: reduce,
    addEventListener() {},
    removeEventListener() {}
  }))
}

describe('feedback：触感', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    delete navigator.vibrate
  })

  it('haptics 默认开：tap 触发短振动', () => {
    const vibrate = stubVibrate()
    expect(tap()).toBe(true)
    expect(vibrate).toHaveBeenCalledWith(10)
  })

  it('完成时刻用不同的振动模式，能与普通点击区分', () => {
    const vibrate = stubVibrate()
    success()
    expect(Array.isArray(vibrate.mock.calls[0][0])).toBe(true)
  })

  it('settings.haptics 关闭时一律不振动', () => {
    const vibrate = stubVibrate()
    saveSettings({ haptics: false })
    expect(tap()).toBe(false)
    expect(success()).toBe(false)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('宿主不支持 vibrate 时静默降级，不抛错', () => {
    expect(() => tap()).not.toThrow()
    expect(tap()).toBe(false)
  })

  it('navigator.vibrate 抛异常时 tap 吞掉异常返回 false', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => {
        throw new Error('振动接口异常')
      },
      configurable: true,
      writable: true
    })
    expect(() => tap()).not.toThrow()
    expect(tap()).toBe(false)
  })
})

describe('feedback：轻提示', () => {
  beforeEach(() => {
    localStorage.clear()
    toasts.splice(0, toasts.length)
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('入队后可读，超时自动出队', () => {
    toast('已记下')
    expect(toasts).toHaveLength(1)
    expect(toasts[0].text).toBe('已记下')
    expect(toasts[0].type).toBe('info') // 默认档
    vi.advanceTimersByTime(TOAST_MS + 50)
    expect(toasts).toHaveLength(0)
  })

  it('两档类型：info / success，id 不重复', () => {
    const a = toast('提示')
    const b = toast('完成了', 'success')
    expect(a).not.toBe(b)
    expect(toasts[1].type).toBe('success')
  })

  it('warn 档入队后类型标记为 warn', () => {
    toast('注意', 'warn')
    expect(toasts).toHaveLength(1)
    expect(toasts[0].text).toBe('注意')
    expect(toasts[0].type).toBe('warn')
  })

  it('toast 已被清空后超时回调不炸，也不误删后来入队的提示', () => {
    toast('会被先清掉')
    toasts.splice(0, toasts.length) // 视图批量清队先于超时发生
    vi.advanceTimersByTime(TOAST_MS - 1)
    const freshId = toast('后入队的')
    // 旧 toast 的超时到点（新 toast 还没到点）：i===-1 分支不得动队列——
    // 若漏了守卫，splice(-1,1) 会把队尾的新提示误删
    vi.advanceTimersByTime(1)
    expect(toasts).toHaveLength(1)
    expect(toasts[0].id).toBe(freshId)
    vi.advanceTimersByTime(TOAST_MS + 50) // 新 toast 自己的超时正常出队
    expect(toasts).toHaveLength(0)
  })
})

describe('feedback：动效降级', () => {
  beforeEach(() => {
    localStorage.clear()
    stubReduceMotion(false)
    document.documentElement.removeAttribute('data-motion')
  })

  it('settings.reducedMotion 为 null 时跟随系统', () => {
    expect(prefersReducedMotion()).toBe(false)
    stubReduceMotion(true)
    expect(prefersReducedMotion()).toBe(true)
  })

  it('settings.reducedMotion 显式取值时覆盖系统', () => {
    stubReduceMotion(true)
    saveSettings({ reducedMotion: false })
    expect(prefersReducedMotion()).toBe(false)
    saveSettings({ reducedMotion: true })
    stubReduceMotion(false)
    expect(prefersReducedMotion()).toBe(true)
  })

  it('applyMotionPreference 把判定写到 data-motion', () => {
    applyMotionPreference()
    expect(document.documentElement.getAttribute('data-motion')).toBe('full')
    saveSettings({ reducedMotion: true })
    applyMotionPreference()
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduced')
  })

  it('scrollBehavior：正常动效返回 smooth，系统或设置降级时返回 auto', () => {
    expect(scrollBehavior()).toBe('smooth')
    stubReduceMotion(true) // 系统开启减弱动效
    expect(scrollBehavior()).toBe('auto')
    stubReduceMotion(false)
    saveSettings({ reducedMotion: true }) // 设置显式降级优先于系统
    expect(scrollBehavior()).toBe('auto')
  })

  it('matchMedia 抛异常时按「不降级」处理，applyMotionPreference 落 full 不炸', () => {
    window.matchMedia = vi.fn(() => {
      throw new Error('媒体查询不支持')
    })
    expect(prefersReducedMotion()).toBe(false)
    applyMotionPreference()
    expect(document.documentElement.getAttribute('data-motion')).toBe('full')
    expect(scrollBehavior()).toBe('smooth')
  })

  it('宿主没有 matchMedia（老 WebView）时同样按「不降级」处理', () => {
    window.matchMedia = undefined
    expect(prefersReducedMotion()).toBe(false)
    applyMotionPreference()
    expect(document.documentElement.getAttribute('data-motion')).toBe('full')
    expect(scrollBehavior()).toBe('smooth')
  })
})
