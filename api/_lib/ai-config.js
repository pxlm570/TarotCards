// 默认 AI 统一配置（2026-09-25 用户拍板）：供应商端点/模型/Key 只存 Supabase
// app_config 表（RLS 无策略，仅 service_role 可读写），代码与公开文档零供应商
// 信息，浏览器端永不接触。纯函数部分供服务端、ai:config 脚本与测试共用。
import { getServiceClient } from './supabase.js'

export const AI_CONFIG_KEY = 'ai'

// 兜底档位参数：价格按「每百万 tokens 人民币」计。预算估算精度取决于这里与
// 实际供应商价格的偏差，上线前应通过 ai:config 按真实价格覆盖。
export const AI_CONFIG_DEFAULTS = Object.freeze({
  max_tokens_standard: 1200,
  max_tokens_deep: 3000,
  price_standard_in: 2,
  price_standard_out: 8,
  price_deep_in: 2,
  price_deep_out: 8
})

const AI_CONFIG_STRINGS = ['base_url', 'api_key', 'model_standard', 'model_deep']
const AI_CONFIG_NUMBERS = Object.keys(AI_CONFIG_DEFAULTS)

function cleanString(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function cleanNumber(v) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// 坏值不落库不生效：字符串字段非空才收，数值字段非负有限才收，未知键一律丢弃
export function normalizeAiConfig(doc) {
  const out = { ...AI_CONFIG_DEFAULTS }
  if (!doc || typeof doc !== 'object') return out
  for (const key of AI_CONFIG_STRINGS) {
    const v = cleanString(doc[key])
    if (v) out[key] = v
  }
  for (const key of AI_CONFIG_NUMBERS) {
    const v = cleanNumber(doc[key])
    if (v !== null) out[key] = v
  }
  const budget = cleanNumber(doc.monthly_budget_cny)
  if (budget !== null && budget > 0) out.monthly_budget_cny = budget
  if (out.base_url) out.base_url = out.base_url.replace(/\/+$/, '')
  return out
}

export function missingAiConfigFields(config) {
  return AI_CONFIG_STRINGS.filter((key) => !config[key])
}

// 服务端每次外呼前的最终解析；必需字段不齐返回 not_configured，调用方 503 拒服
export function resolveAiConfig(config, mode, fallbackBudgetCny) {
  const c = normalizeAiConfig(config)
  if (missingAiConfigFields(c).length) return { error: 'not_configured' }
  const deep = mode === 'deep'
  const envBudget = Number(fallbackBudgetCny)
  return {
    baseUrl: c.base_url,
    apiKey: c.api_key,
    model: deep ? c.model_deep : c.model_standard,
    maxTokens: Math.round(deep ? c.max_tokens_deep : c.max_tokens_standard),
    priceIn: deep ? c.price_deep_in : c.price_standard_in,
    priceOut: deep ? c.price_deep_out : c.price_standard_out,
    monthlyBudgetCny: c.monthly_budget_cny ?? (envBudget > 0 ? envBudget : 100)
  }
}

export function maskApiKey(key) {
  if (!key) return '（未设置）'
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}…${key.slice(-2)}`
}

// 站长 GUI 配置表单（2026-09-25 用户要求表单化）的补丁校验：字段白名单 +
// 类型检查。空串必须显式拒绝——Number('') === 0 会把档位参数悄悄写成 0。
const PATCH_STRING_FIELDS = AI_CONFIG_STRINGS
const PATCH_NUMBER_FIELDS = [...AI_CONFIG_NUMBERS, 'monthly_budget_cny']

export function buildConfigPatch(input) {
  const patch = {}
  if (!input || typeof input !== 'object') return { ok: true, patch }
  for (const key of PATCH_STRING_FIELDS) {
    if (!Object.hasOwn(input, key)) continue
    const v = typeof input[key] === 'string' ? input[key].trim() : input[key]
    if (typeof v !== 'string' || !v) return { ok: false, error: `${key} 不能为空` }
    patch[key] = v
  }
  for (const key of PATCH_NUMBER_FIELDS) {
    if (!Object.hasOwn(input, key)) continue
    if (typeof input[key] === 'string' && !input[key].trim()) {
      return { ok: false, error: `${key} 不能为空` }
    }
    const n = Number(input[key])
    if (!Number.isFinite(n) || n < 0 || (key === 'monthly_budget_cny' && n <= 0)) {
      return { ok: false, error: `${key} 需要是正数` }
    }
    patch[key] = n
  }
  return { ok: true, patch }
}

// 服务端读取带 60s 进程内缓存：配置变更最迟一分钟生效，免去每次请求一趟 DB。
// Vercel 函数实例本就短命，这里不做跨实例失效。
let cache = { at: 0, doc: null }
const CACHE_MS = 60_000

export function resetAiConfigCacheForTests() {
  cache = { at: 0, doc: null }
}

export async function loadAiConfig() {
  const now = Date.now()
  if (cache.doc && now - cache.at < CACHE_MS) return cache.doc
  const client = getServiceClient()
  const { data, error } = await client
    .from('app_config')
    .select('value')
    .eq('key', AI_CONFIG_KEY)
    .maybeSingle()
  if (error) throw new Error('AI 配置读取失败')
  cache = { at: now, doc: normalizeAiConfig(data?.value) }
  return cache.doc
}
