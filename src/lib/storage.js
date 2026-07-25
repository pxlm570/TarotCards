// 存储契约（M1 定死，M2-M5 只增 UI 不改 key）：
//   localStorage  tarot.settings.v1  —— 全量设置，完整 schema 见 DEFAULT_SETTINGS
//   sessionStorage tarot.flow.v1     —— 占卜流程态（误刷新可恢复，关标签页清空）
// 所有读写都做异常兜底：localStorage 被禁用/写满时静默降级，不崩溃。

const SETTINGS_KEY = 'tarot.settings.v1'
export const FLOW_KEY = 'tarot.flow.v1'

export const DEFAULT_SETTINGS = Object.freeze({
  apiKey: '',
  baseUrl: '',
  model: '',
  persona: 'gentle', // gentle | direct | scholar
  reversalsEnabled: false, // 逆位默认关：新手解读负担减半，M2 第 5 章后引导开启
  autoDraw: false,
  theme: 'dark',
  sound: false,
  haptics: true,
  deckId: 'rws',
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
