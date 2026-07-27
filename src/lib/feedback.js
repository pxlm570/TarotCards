// 交互反馈体系（M1.5 Task 4.5）——"每一次点击都有可感知的反馈"。
// 触感、轻提示、动效降级三件事收在这里，视图不再各写各的 navigator.vibrate。
import { reactive } from 'vue'
import { loadSettings } from './storage.js'

// ---------- 触感 ----------
function buzz(pattern) {
  try {
    if (!loadSettings().haptics) return false
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
    navigator.vibrate(pattern)
    return true
  } catch {
    return false // 桌面/权限受限：静默降级
  }
}

/** 普通点击、选中、切换 */
export function tap() {
  return buzz(10)
}

/** 完成时刻：选满牌 / 全部翻开 / 记下感想——手感要和普通点击不同 */
export function success() {
  return buzz([14, 40, 22])
}

// ---------- 轻提示 ----------
export const TOAST_MS = 2200

export const toasts = reactive([])

let seq = 0

/** type: 'info' | 'success'（M2 的成就 Toast 复用同一组件） */
export function toast(text, type = 'info') {
  const id = ++seq
  toasts.push({ id, text, type })
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id)
    if (i > -1) toasts.splice(i, 1)
  }, TOAST_MS)
  return id
}

// ---------- 动效降级 ----------
/** settings.reducedMotion 显式取值优先，null = 跟随系统 prefers-reduced-motion */
export function prefersReducedMotion() {
  const pref = loadSettings().reducedMotion
  if (typeof pref === 'boolean') return pref
  try {
    return typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  } catch {
    return false
  }
}

/** 写 <html data-motion>，components.css 据此全局降级（CSS 媒体查询覆盖不到 app 内设置） */
export function applyMotionPreference() {
  document.documentElement.setAttribute('data-motion', prefersReducedMotion() ? 'reduced' : 'full')
}
