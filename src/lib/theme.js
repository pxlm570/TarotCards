// 主题机制（M1.5 定稿 2026-07-26）：浅色为默认基准、暗夜为可选，
// settings.theme = 'auto'（跟随系统 prefers-color-scheme）| 'light' | 'dark'。
// index.html 头部有同逻辑的内联脚本负责首帧不闪；此处负责运行期切换与系统偏好联动。
import { loadSettings, saveSettings } from './storage.js'

export const THEME_VALUES = Object.freeze(['auto', 'light', 'dark'])

// 与 tokens.css 的 --bg 一致；同时喂给 theme-color meta（PWA 状态栏/地址栏）
export const THEME_BG = Object.freeze({ light: '#FAF6ED', dark: '#0F1523' })

const DARK_QUERY = '(prefers-color-scheme: dark)'

function systemPrefersDark() {
  // jsdom 与老 WebView 可能没有 matchMedia：一律按浅色（默认基准）处理
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
  } catch {
    return false
  }
}

export function resolveTheme(pref) {
  if (pref === 'light' || pref === 'dark') return pref
  return systemPrefersDark() ? 'dark' : 'light' // 'auto' 与任何非法值
}

export function applyTheme(pref) {
  const theme = resolveTheme(pref)
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.style.background = THEME_BG[theme]

  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', THEME_BG[theme])
  return theme
}

export function setTheme(pref) {
  const next = THEME_VALUES.includes(pref) ? pref : 'auto'
  saveSettings({ theme: next })
  return applyTheme(next)
}

// 重复 initTheme（HMR / 测试）不叠加监听：先摘掉上一次的
let boundMq = null
let boundHandler = null

function unbind() {
  if (!boundMq || !boundHandler) return
  if (boundMq.removeEventListener) boundMq.removeEventListener('change', boundHandler)
  else if (boundMq.removeListener) boundMq.removeListener(boundHandler)
  boundMq = null
  boundHandler = null
}

export function initTheme() {
  applyTheme(loadSettings().theme)
  if (typeof window.matchMedia !== 'function') return
  try {
    unbind()
    const mq = window.matchMedia(DARK_QUERY)
    // 每次系统变化都按「当前存的偏好」重算：auto 跟随，手动锁定时结果不变
    const onChange = () => applyTheme(loadSettings().theme)
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else if (mq.addListener) mq.addListener(onChange) // Safari ≤13
    boundMq = mq
    boundHandler = onChange
  } catch {
    /* 宿主不支持媒体查询监听：保持首帧解析结果 */
  }
}
