// 统一 LLM 配置命令（2026-09-25 用户拍板）：把模型端点/名称/API Key/档位参数/
// 月预算写入 Supabase app_config 表。该表对网站访客完全不可读（RLS 无策略、
// 客户端角色无授权），只有持有 SUPABASE_SERVICE_ROLE_KEY 的本机能读写——
// 配置不走代码仓库，不进前端，不暴露给任何用户。
//
// 用法：
//   npm run ai:config                # 查看当前配置（API Key 脱敏显示）
//   npm run ai:config -- --base-url=https://api.example.com/v1 --api-key=sk-xxx \
//     --model-standard=模型A --model-deep=模型B --budget=100
// 字段只增改不清除；首次配置必须补齐 base-url / api-key / model-standard / model-deep。
import { createClient } from '@supabase/supabase-js'
import {
  AI_CONFIG_KEY,
  AI_CONFIG_DEFAULTS,
  normalizeAiConfig,
  missingAiConfigFields,
  maskApiKey
} from '../api/_lib/ai-config.js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('请先设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。')
  process.exit(1)
}

const FIELD_DEFS = [
  { arg: 'base-url', key: 'base_url', desc: '模型服务 API 根地址（OpenAI 兼容，通常含 /v1）' },
  { arg: 'api-key', key: 'api_key', desc: '模型服务 API Key' },
  { arg: 'model-standard', key: 'model_standard', desc: '普通档模型名' },
  { arg: 'model-deep', key: 'model_deep', desc: '深度档模型名' },
  { arg: 'max-tokens-standard', key: 'max_tokens_standard' },
  { arg: 'max-tokens-deep', key: 'max_tokens_deep' },
  { arg: 'price-standard-in', key: 'price_standard_in' },
  { arg: 'price-standard-out', key: 'price_standard_out' },
  { arg: 'price-deep-in', key: 'price_deep_in' },
  { arg: 'price-deep-out', key: 'price_deep_out' },
  { arg: 'budget', key: 'monthly_budget_cny' }
]
const NUMERIC_KEYS = new Set(Object.keys(AI_CONFIG_DEFAULTS).concat(['monthly_budget_cny']))

function parsePatch(argv) {
  const patch = {}
  for (const raw of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(raw)
    const def = match && FIELD_DEFS.find((f) => f.arg === match[1])
    if (!def) {
      console.error(`无法识别的参数：${raw}`)
      console.error(`可用参数：${FIELD_DEFS.map((f) => `--${f.arg}`).join(' ')}`)
      process.exit(1)
    }
    const value = match[2].trim()
    if (NUMERIC_KEYS.has(def.key)) {
      const n = Number(value)
      if (!Number.isFinite(n) || n < 0 || (def.key === 'monthly_budget_cny' && n <= 0)) {
        console.error(`--${def.arg} 需要一个正数，收到：${value}`)
        process.exit(1)
      }
      patch[def.key] = n
    } else if (!value) {
      console.error(`--${def.arg} 不能为空（如需清除字段请直接改数据库）`)
      process.exit(1)
    } else {
      patch[def.key] = value
    }
  }
  return patch
}

function printConfig(config) {
  const rows = [
    ['base_url', config.base_url],
    ['model_standard', config.model_standard],
    ['model_deep', config.model_deep],
    ['max_tokens_standard', config.max_tokens_standard],
    ['max_tokens_deep', config.max_tokens_deep],
    ['price_standard_in (¥/百万tokens)', config.price_standard_in],
    ['price_standard_out (¥/百万tokens)', config.price_standard_out],
    ['price_deep_in (¥/百万tokens)', config.price_deep_in],
    ['price_deep_out (¥/百万tokens)', config.price_deep_out],
    ['monthly_budget_cny', config.monthly_budget_cny ?? '（未设置，服务端回落环境变量或 100）'],
    ['api_key', maskApiKey(config.api_key)]
  ]
  for (const [label, value] of rows) console.log(`  ${label.padEnd(34)}${value}`)
  const missing = missingAiConfigFields(config)
  if (missing.length) {
    console.error(`\n配置尚不完整，还缺：${missing.join('、')}`)
    console.error('补齐前服务端会拒绝所有默认 AI 请求（503 默认 AI 暂未启用）。')
  }
}

const client = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function fetchCurrent() {
  const { data, error } = await client
    .from('app_config')
    .select('value')
    .eq('key', AI_CONFIG_KEY)
    .maybeSingle()
  if (error) {
    console.error(`读取配置失败（${error.message}）。请确认已执行 supabase/migrations/202609250001_app_config.sql。`)
    process.exit(1)
  }
  return data?.value ?? null
}

const patch = parsePatch(process.argv.slice(2))
const current = await fetchCurrent()

if (Object.keys(patch).length === 0) {
  console.log('当前统一 LLM 配置：')
  printConfig(normalizeAiConfig(current))
  process.exit(0)
}

const merged = normalizeAiConfig({ ...normalizeAiConfig(current), ...patch })
const missing = missingAiConfigFields(merged)
if (missing.length) {
  console.error('保存被拒绝：合并后配置仍缺少必需字段——')
  for (const key of missing) {
    const def = FIELD_DEFS.find((f) => f.key === key)
    console.error(`  --${def.arg}    ${def.desc}`)
  }
  process.exit(1)
}

const { error } = await client
  .from('app_config')
  .upsert({ key: AI_CONFIG_KEY, value: merged, updated_at: new Date().toISOString() })
if (error) {
  console.error(`保存失败（${error.message}）。`)
  process.exit(1)
}
console.log('已保存统一 LLM 配置：')
printConfig(merged)
console.log('\n服务端最迟 60 秒后生效（进程内缓存），无需重新部署。')
