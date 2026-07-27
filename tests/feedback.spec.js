// 反馈体系（M1.5 Task 4.5）：触感统一封装、轻提示队列、动效降级判定
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  tap,
  success,
  toast,
  toasts,
  TOAST_MS,
  prefersReducedMotion,
  applyMotionPreference
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
})
