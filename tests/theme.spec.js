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

// 边界与降级分支（2026-10-24 补薄弱覆盖）：宿主缺 matchMedia / matchMedia 抛错 /
// 监听卫生 / 手动锁定不被系统覆盖 / theme-color meta 自建
describe('theme：边界与降级', () => {
  beforeEach(() => {
    localStorage.clear()
    delete window.matchMedia
    document.documentElement.removeAttribute('data-theme')
    document.querySelector('meta[name="theme-color"]')?.remove()
  })

  it('THEME_BG 与 tokens.css 的 --bg 对齐（浅色米白 / 暗夜藏青）', () => {
    expect(THEME_BG.light).toBe('#FAF6ED')
    expect(THEME_BG.dark).toBe('#0F1523')
  })

  it('setTheme 非法值回落 auto：按系统解析生效并持久化为 auto', () => {
    stubSystemDark(true)
    expect(setTheme('紫色')).toBe('dark')
    expect(loadSettings().theme).toBe('auto')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('applyTheme 在无 theme-color meta 时创建挂载，已有则复用不新增', () => {
    expect(document.querySelector('meta[name="theme-color"]')).toBeNull()
    expect(applyTheme('dark')).toBe('dark')
    const meta = document.querySelector('meta[name="theme-color"]')
    expect(meta.getAttribute('content')).toBe(THEME_BG.dark)
    applyTheme('light')
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1)
    expect(document.querySelector('meta[name="theme-color"]').content).toBe(THEME_BG.light)
  })

  it('initTheme 无 matchMedia：不抛，无偏好按浅色、有偏好按已存值应用', () => {
    saveSettings({ theme: 'dark' })
    expect(() => initTheme()).not.toThrow()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    localStorage.clear()
    expect(() => initTheme()).not.toThrow()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('重复 initTheme 不叠加媒体查询监听（HMR / 测试场景）', () => {
    const listeners = stubSystemDark(false)
    initTheme()
    initTheme()
    expect(listeners.size).toBe(1)
  })

  it('手动锁定 dark：系统偏好变化回调按已存偏好重算，仍 dark 不跟随系统', () => {
    const listeners = stubSystemDark(true)
    saveSettings({ theme: 'dark' })
    initTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    stubSystemDark(false) // 系统切浅
    listeners.forEach((fn) => fn({ matches: false }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('matchMedia 抛错：resolveTheme / initTheme 静默降级不炸', () => {
    window.matchMedia = vi.fn(() => { throw new Error('媒体查询不支持') })
    expect(resolveTheme('auto')).toBe('light')
    saveSettings({ theme: 'dark' })
    expect(() => initTheme()).not.toThrow()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('Safari ≤13 旧监听 API（addListener/removeListener）：能绑定，重复 init 先解绑再绑', () => {
    // 桩只带旧 API：走 initTheme 的 addListener 分支与 unbind 的 removeListener 分支
    let added = 0
    let removed = 0
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addListener: () => { added++ },
      removeListener: () => { removed++ }
    }))
    initTheme()
    expect(added).toBe(1)
    initTheme() // HMR/重复初始化：摘掉旧监听再挂新的，不叠加
    expect(removed).toBe(1)
    expect(added).toBe(2)
  })
})
