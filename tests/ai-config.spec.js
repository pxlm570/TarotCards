// 统一 LLM 配置（2026-09-25 用户拍板）：供应商端点/模型/Key 只存 Supabase app_config
// 表，代码零供应商信息。本 spec 守卫服务端与 ai:config 脚本共用的纯函数——
// 坏值不得覆盖默认值（同 settings 逐字段校验约定），必需字段缺失一律 503 拒服。
import { describe, it, expect } from 'vitest'
import {
  normalizeAiConfig,
  missingAiConfigFields,
  resolveAiConfig,
  maskApiKey,
  AI_CONFIG_DEFAULTS
} from '../api/_lib/ai-config.js'

describe('ai-config：normalizeAiConfig', () => {
  it('空/坏文档回落默认档位参数', () => {
    expect(normalizeAiConfig(null)).toEqual(AI_CONFIG_DEFAULTS)
    expect(normalizeAiConfig('junk')).toEqual(AI_CONFIG_DEFAULTS)
    expect(normalizeAiConfig({ base_url: 42 })).toEqual(AI_CONFIG_DEFAULTS)
  })

  it('合法字段收下、未知键丢弃、base_url 去尾斜杠', () => {
    const doc = normalizeAiConfig({
      base_url: 'https://api.example.com/v1/',
      api_key: 'sk-x',
      model_standard: 'm-std',
      model_deep: 'm-deep',
      monthly_budget_cny: 50,
      hacker_key: 'nope'
    })
    expect(doc.base_url).toBe('https://api.example.com/v1')
    expect(doc.api_key).toBe('sk-x')
    expect(doc.model_standard).toBe('m-std')
    expect(doc.model_deep).toBe('m-deep')
    expect(doc.monthly_budget_cny).toBe(50)
    expect(doc).not.toHaveProperty('hacker_key')
  })

  it('非正数/非有限数值回落默认，不产生 NaN', () => {
    const doc = normalizeAiConfig({
      max_tokens_standard: -5,
      price_deep_in: 'abc',
      monthly_budget_cny: 0
    })
    expect(doc.max_tokens_standard).toBe(AI_CONFIG_DEFAULTS.max_tokens_standard)
    expect(doc.price_deep_in).toBe(AI_CONFIG_DEFAULTS.price_deep_in)
    expect(doc.monthly_budget_cny).toBeUndefined()
    expect(JSON.stringify(doc)).not.toContain('NaN')
  })
})

describe('ai-config：missingAiConfigFields', () => {
  it('缺端点/Key/模型时逐项列出', () => {
    expect(missingAiConfigFields({ base_url: 'https://a.b', api_key: 'k' })).toEqual([
      'model_standard',
      'model_deep'
    ])
    expect(missingAiConfigFields(normalizeAiConfig(null))).toEqual([
      'base_url',
      'api_key',
      'model_standard',
      'model_deep'
    ])
  })
})

describe('ai-config：resolveAiConfig', () => {
  const full = {
    base_url: 'https://api.example.com/v1/',
    api_key: 'sk-x',
    model_standard: 'm-std',
    model_deep: 'm-deep',
    max_tokens_standard: 900,
    price_deep_out: 12,
    monthly_budget_cny: 66
  }

  it('按档位解析模型/tokens/价格，base_url 已去尾斜杠', () => {
    const std = resolveAiConfig(full, 'standard', 100)
    expect(std).toMatchObject({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-x',
      model: 'm-std',
      maxTokens: 900,
      priceOut: AI_CONFIG_DEFAULTS.price_standard_out,
      monthlyBudgetCny: 66
    })
    const deep = resolveAiConfig(full, 'deep', 100)
    expect(deep).toMatchObject({ model: 'm-deep', maxTokens: AI_CONFIG_DEFAULTS.max_tokens_deep, priceOut: 12 })
  })

  it('预算取值链：配置 > 环境变量兜底 > 默认 100', () => {
    expect(resolveAiConfig(full, 'standard', 80).monthlyBudgetCny).toBe(66)
    const noBudget = { ...full, monthly_budget_cny: undefined }
    expect(resolveAiConfig(noBudget, 'standard', 80).monthlyBudgetCny).toBe(80)
    expect(resolveAiConfig(noBudget, 'standard', -1).monthlyBudgetCny).toBe(100)
    expect(resolveAiConfig(noBudget, 'standard').monthlyBudgetCny).toBe(100)
  })

  it('必需字段不齐 -> not_configured（服务端据此 503 拒服，不外呼）', () => {
    expect(resolveAiConfig({ api_key: 'sk-x' }, 'standard', 100).error).toBe('not_configured')
    expect(resolveAiConfig(null, 'deep', 100).error).toBe('not_configured')
  })
})

describe('ai-config：maskApiKey', () => {
  it('只露首尾，短 key 全掩码', () => {
    expect(maskApiKey('sk-abcdef123456')).toBe('sk-a…56')
    expect(maskApiKey('short')).toBe('••••')
    expect(maskApiKey('')).toBe('（未设置）')
  })
})
