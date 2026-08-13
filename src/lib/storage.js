// 存储契约（M1 定死，M2-M5 只增 UI 不改 key）：
//   localStorage  tarot.settings.v1  —— 全量设置，完整 schema 见 DEFAULT_SETTINGS
//   sessionStorage tarot.flow.v1     —— 占卜流程态（误刷新可恢复，关标签页清空）
// 所有读写都做异常兜底：localStorage 被禁用/写满时静默降级，不崩溃。

const SETTINGS_KEY = 'tarot.settings.v1'
export const FLOW_KEY = 'tarot.flow.v1'

export const DEFAULT_SETTINGS = Object.freeze({
  apiKey: '',
  baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic', // 默认 AI 端点（Anthropic 协议）；key 用户自填
  model: 'mimo-v2.5',
  persona: 'gentle', // gentle | direct | scholar
  reversalsEnabled: false, // 逆位默认关：新手解读负担减半，M2 第 5 章后引导开启
  autoDraw: false,
  theme: 'auto', // auto = 跟随系统 prefers-color-scheme（M1.5 定稿）| light | dark
  sound: false,
  haptics: true,
  deckId: 'rws', // 牌面皮肤（rws / rws-sepia）
  backId: 'star-gold', // 独立牌背（星纹·暖金，与牌面可自由组合）
  reducedMotion: null, // null = 跟随系统 prefers-reduced-motion（M5 UI 生效）
  fontSize: 'standard' // standard | large（M5 生效）
})

// domain 合法值（null = 随心抽）；journal 与 Mirror 引用同一枚举
export const DOMAIN_VALUES = Object.freeze(['love', 'career', 'wealth', 'study', 'general'])

function safeParse(json) {
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

// 裸 localStorage 在 iOS「阻止所有 Cookie」等场景会直接抛 SecurityError——
// 所有非 settings/flow 的零散标记位（visited/引导浮层等）也必须走这两个函数
export function safeGetItem(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function loadSettings() {
  let raw = null
  try {
    raw = safeParse(localStorage.getItem(SETTINGS_KEY))
  } catch {
    raw = null
  }
  return raw && typeof raw === 'object' ? { ...DEFAULT_SETTINGS, ...raw } : { ...DEFAULT_SETTINGS }
}

export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch {
    /* 存储不可用时仅内存生效 */
  }
  return next
}

export function loadFlow() {
  try {
    return safeParse(sessionStorage.getItem(FLOW_KEY))
  } catch {
    return null
  }
}

export function saveFlow(state) {
  try {
    sessionStorage.setItem(FLOW_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function clearFlow() {
  try {
    sessionStorage.removeItem(FLOW_KEY)
  } catch {
    /* ignore */
  }
}
