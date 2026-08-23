// 存储契约（M1 定死，M2-M5 只增 UI 不改 key）：
//   localStorage  tarot.settings.v1  —— 全量设置，完整 schema 见 DEFAULT_SETTINGS
//   sessionStorage tarot.flow.v1     —— 占卜流程态（误刷新可恢复，关标签页清空）
// 所有读写都做异常兜底：localStorage 被禁用/写满时静默降级，不崩溃。

const SETTINGS_KEY = 'tarot.settings.v1'
export const FLOW_KEY = 'tarot.flow.v1'

export const DEFAULT_SETTINGS = Object.freeze({
  apiKey: '',
  baseUrl: '', // 不做官方端点绑定，默认留空；用户自填或从设置页「快捷填充」选
  model: '',
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

export function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function safeKeys() {
  try {
    return Object.keys(localStorage)
  } catch {
    return []
  }
}

// 已知字段逐项校验：存储里的坏值（null/类型漂移/旧版本残留）不得覆盖默认值
const SETTINGS_VALIDATORS = {
  apiKey: (v) => (typeof v === 'string' ? v : ''),
  baseUrl: (v) => (typeof v === 'string' ? v : ''),
  model: (v) => (typeof v === 'string' ? v : ''),
  persona: (v) => (['gentle', 'direct', 'scholar'].includes(v) ? v : 'gentle'),
  reversalsEnabled: (v) => (typeof v === 'boolean' ? v : false),
  autoDraw: (v) => (typeof v === 'boolean' ? v : false),
  theme: (v) => (['auto', 'light', 'dark'].includes(v) ? v : 'auto'),
  sound: (v) => (typeof v === 'boolean' ? v : false),
  haptics: (v) => (typeof v === 'boolean' ? v : true),
  deckId: (v) => (typeof v === 'string' && v ? v : 'rws'),
  backId: (v) => (typeof v === 'string' && v ? v : 'star-gold'),
  reducedMotion: (v) => (v === null || typeof v === 'boolean' ? v : null),
  fontSize: (v) => (['standard', 'large'].includes(v) ? v : 'standard')
}

export function loadSettings() {
  let raw = null
  try {
    raw = safeParse(localStorage.getItem(SETTINGS_KEY))
  } catch {
    raw = null
  }
  const settings = { ...DEFAULT_SETTINGS }
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (k in raw) settings[k] = SETTINGS_VALIDATORS[k](raw[k])
    }
  }
  return settings
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
