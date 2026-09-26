// 匿名产品统计（2026-09-26 用户拍板）：只记页面路径与功能使用次数，
// 绝不记录占卜问题/牌阵/解读内容。批量节流上报，失败静默——统计永不影响功能。
import { supabase } from './supabase.js'

const FLUSH_SIZE = 12
const FLUSH_DELAY_MS = 5000
let queue = []
let timer = null

export function track(name, path) {
  if (!supabase || !name) return
  queue.push({ name, path: typeof path === 'string' && path ? path.slice(0, 120) : undefined })
  if (queue.length >= FLUSH_SIZE) {
    flush()
  } else if (!timer) {
    timer = setTimeout(flush, FLUSH_DELAY_MS)
  }
}

export async function flush() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (!queue.length) return
  const batch = queue.splice(0, queue.length)
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events: batch }),
      keepalive: true
    })
  } catch {
    // 统计失败静默丢弃，不重试不提示
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    flush()
  })
}
