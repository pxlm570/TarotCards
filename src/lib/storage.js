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

// 写失败告警（评审 2026-09-06）：safeSetItem 静默失败曾让「已保存」toast 假成功——
// 配额满后用户以为存了，刷新即丢。UI 侧经 setStorageWarnHandler 注入（避免 storage→feedback
// 循环依赖），15s 节流防止批量写（导入/淘汰）时刷屏。
let storageWarnHandler = null
let lastWarnAt = -Infinity

export function setStorageWarnHandler(fn) {
  storageWarnHandler = typeof fn === 'function' ? fn : null
}

function warnStorageFull() {
  if (!storageWarnHandler) return
  const now = Date.now()
  if (now - lastWarnAt < 15000) return
  lastWarnAt = now
  try {
    storageWarnHandler('存储空间不足，最近的修改可能没有保存，建议先导出备份')
  } catch {
    /* 提示失败不影响主流程 */
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    warnStorageFull()
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
  const previous = loadSettings()
  const next = { ...previous, ...patch }
  // 凭证随端点归属；只有同一次提交明确提供的新 key 才能跨端点使用。
  const endpoint = (value) => String(value ?? '').trim().replace(/\/+$/, '')
  if ('baseUrl' in patch && endpoint(patch.baseUrl) !== endpoint(previous.baseUrl) && !Object.hasOwn(patch, 'apiKey')) {
    next.apiKey = ''
  }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch {
    warnStorageFull() // 存储不可用时仅内存生效，但用户必须知道没存上
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
    sessionStorage.removeItem('tarot.practice-pending.v1') // 清理旧版本未绑定会话的任务
  } catch {
    /* ignore */
  }
}
