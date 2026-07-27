// 主题机制（M1.5 定稿：theme 默认 'auto' 跟随系统，可手动锁 light/dark）
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  THEME_VALUES,
  THEME_BG,
  resolveTheme,
  applyTheme,
  initTheme,
  setTheme
} from '../src/lib/theme.js'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/lib/storage.js'

// jsdom 不实现 matchMedia：按需注入桩，顺带覆盖「宿主没有 matchMedia」的降级分支
function stubSystemDark(dark) {
  const listeners = new Set()
  window.matchMedia = vi.fn(() => ({
    matches: dark,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn)
  }))
  return listeners
}

describe('theme：偏好解析', () => {
  beforeEach(() => {
    localStorage.clear()
    delete window.matchMedia
    document.documentElement.removeAttribute('data-theme')
  })

  it('settings 默认 theme 为 auto', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('auto')
    expect(loadSettings().theme).toBe('auto')
  })

  it('三个合法值：auto / light / dark', () => {
    expect(THEME_VALUES).toEqual(['auto', 'light', 'dark'])
  })

  it('手动锁定时忽略系统偏好', () => {
    stubSystemDark(true)
    expect(resolveTheme('light')).toBe('light')
    stubSystemDark(false)
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('auto 跟随系统 prefers-color-scheme', () => {
    stubSystemDark(true)
    expect(resolveTheme('auto')).toBe('dark')
    stubSystemDark(false)
    expect(resolveTheme('auto')).toBe('light')
  })

  it('非法值与缺失 matchMedia 一律回退浅色', () => {
    stubSystemDark(true)
    expect(resolveTheme('紫色')).toBe('dark') // 非法值按 auto 处理
    delete window.matchMedia
    expect(resolveTheme('auto')).toBe('light')
  })
})

describe('theme：落到 DOM', () => {
  beforeEach(() => {
    localStorage.clear()
    stubSystemDark(false)
    document.documentElement.removeAttribute('data-theme')
    document.querySelector('meta[name="theme-color"]')?.remove()
  })

  it('applyTheme 写 data-theme、theme-color meta 与根底色', () => {
    expect(applyTheme('dark')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.querySelector('meta[name="theme-color"]').content).toBe(THEME_BG.dark)
    expect(document.documentElement.style.background).toBeTruthy()

    applyTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.querySelector('meta[name="theme-color"]').content).toBe(THEME_BG.light)
  })

  it('setTheme 持久化到 tarot.settings.v1 并立即生效', () => {
    setTheme('dark')
    expect(loadSettings().theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('initTheme 读取已存偏好', () => {
    saveSettings({ theme: 'dark' })
    initTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('initTheme 在 auto 下随系统变化实时切换', () => {
    const listeners = stubSystemDark(false)
    initTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    // 系统切到暗色：媒体查询回调触发重算
    stubSystemDark(true)
    listeners.forEach((fn) => fn({ matches: true }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
