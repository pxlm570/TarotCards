// #import= 配置分享链接的两段式导入（评审 2026-09-03 根因收口）：
// 此前 main.js 解析到链接就静默 saveSettings——任何人可伪造「免费配置」链接静默替换
// 用户的 AI 端点，后续占卜提问全部流向第三方且毫无察觉。改为：解析暂存 -> 跳设置页
// 出「应用/放弃」确认条（AiView 消费）。
// 暂存走 sessionStorage（关标签即弃，确认是即时动作不留尾）；sessionStorage 在
// iOS 阻 Cookie 等场景同样可能被禁，本地 try/catch 兜底（同 lib/practice.js 口径）。
const KEY = 'tarot.import-pending.v1'

export const IMPORT_PENDING_KEY = KEY

function getSession(json) {
  try {
    return sessionStorage.getItem(json)
  } catch {
    return null
  }
}

function setSession(key, value) {
  try {
    sessionStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function removeSession(key) {
  try {
    sessionStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/** 解析 #import=<base64> 的 payload；非本协议 / 坏编码 / 无任何配置字段一律 null */
export function parseImportHash(hash) {
  if (!hash || !hash.startsWith('#import=')) return null
  try {
    const raw = hash.slice('#import='.length)
    const json = decodeURIComponent(escape(atob(raw)))
    const cfg = JSON.parse(json)
    if (cfg && typeof cfg === 'object' && (cfg.baseUrl || cfg.model || cfg.apiKey)) {
      return { baseUrl: cfg.baseUrl || '', model: cfg.model || '', apiKey: cfg.apiKey || '' }
    }
  } catch {
    /* 无效链接：按无导入处理 */
  }
  return null
}

export function stashPendingImport(cfg) {
  setSession(KEY, JSON.stringify(cfg))
}

/** 取走暂存配置（取即清，防止残影被二次确认） */
export function takePendingImport() {
  const raw = getSession(KEY)
  if (!raw) return null
  removeSession(KEY)
  try {
    const cfg = JSON.parse(raw)
    return cfg && typeof cfg === 'object' ? cfg : null
  } catch {
    return null
  }
}

export function discardPendingImport() {
  removeSession(KEY)
}
