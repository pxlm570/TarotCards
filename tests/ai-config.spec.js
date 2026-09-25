// 统一 LLM 配置（2026-09-25 用户拍板）：供应商端点/模型/Key 只存 Supabase app_config
// 表，代码零供应商信息。本 spec 守卫服务端、站长 GUI 与 ai:config 脚本共用的纯函数——
// 坏值不得覆盖默认值（同 settings 逐字段校验约定），必需字段缺失一律 503 拒服。
// 额度模型（2026-09-26 用户拍板）：按人按天限额（普通 5/天、深度 1/天，可配置），
// 共享月预算机制整体移除。
import { describe, it, expect } from 'vitest'
import {
  normalizeAiConfig,
  missingAiConfigFields,
  resolveAiConfig,
  maskApiKey,
  buildConfigPatch,
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
      daily_standard_limit: 8,
      hacker_key: 'nope'
    })
    expect(doc.base_url).toBe('https://api.example.com/v1')
    expect(doc.api_key).toBe('sk-x')
    expect(doc.model_standard).toBe('m-std')
    expect(doc.model_deep).toBe('m-deep')
    expect(doc.daily_standard_limit).toBe(8)
    expect(doc).not.toHaveProperty('hacker_key')
    // 月预算机制已移除：历史残留键一律丢弃
    expect(doc).not.toHaveProperty('monthly_budget_cny')
  })

  it('非正数/非有限数值回落默认，不产生 NaN', () => {
    const doc = normalizeAiConfig({
      max_tokens_standard: -5,
      price_deep_in: 'abc',
      daily_deep_limit: 0
    })
    expect(doc.max_tokens_standard).toBe(AI_CONFIG_DEFAULTS.max_tokens_standard)
    expect(doc.price_deep_in).toBe(AI_CONFIG_DEFAULTS.price_deep_in)
    expect(doc.daily_deep_limit).toBe(AI_CONFIG_DEFAULTS.daily_deep_limit)
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
    daily_standard_limit: 8,
    daily_deep_limit: 2
  }

  it('按档位解析模型/tokens/价格与每日限额，base_url 已去尾斜杠', () => {
    const std = resolveAiConfig(full, 'standard')
    expect(std).toMatchObject({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-x',
      model: 'm-std',
      maxTokens: 900,
      priceOut: AI_CONFIG_DEFAULTS.price_standard_out,
      dailyStandardLimit: 8,
      dailyDeepLimit: 2
    })
    const deep = resolveAiConfig(full, 'deep')
    expect(deep).toMatchObject({
      model: 'm-deep',
      maxTokens: AI_CONFIG_DEFAULTS.max_tokens_deep,
      priceOut: 12
    })
  })

  it('缺省时每日限额回落默认：普通 5/天、深度 1/天', () => {
    const r = resolveAiConfig({ base_url: 'https://a.b/v1', api_key: 'k', model_standard: 'm', model_deep: 'm2' }, 'standard')
    expect(r.dailyStandardLimit).toBe(5)
    expect(r.dailyDeepLimit).toBe(1)
  })

  it('必需字段不齐 -> not_configured（服务端据此 503 拒服，不外呼）', () => {
    expect(resolveAiConfig({ api_key: 'sk-x' }, 'standard').error).toBe('not_configured')
    expect(resolveAiConfig(null, 'deep').error).toBe('not_configured')
  })
})

describe('ai-config：maskApiKey', () => {
  it('只露首尾，短 key 全掩码', () => {
    expect(maskApiKey('sk-abcdef123456')).toBe('sk-a…56')
    expect(maskApiKey('short')).toBe('••••')
    expect(maskApiKey('')).toBe('（未设置）')
  })
})

describe('ai-config：buildConfigPatch（站长 GUI 表单补丁）', () => {
  it('合法字符串与数字收进补丁，数字自动转换', () => {
    const { ok, patch } = buildConfigPatch({
      base_url: ' https://api.example.com/v1 ',
      api_key: 'sk-new',
      model_standard: 'm-std',
      model_deep: 'm-deep',
      daily_standard_limit: '8',
      max_tokens_standard: 900
    })
    expect(ok).toBe(true)
    expect(patch).toEqual({
      base_url: 'https://api.example.com/v1',
      api_key: 'sk-new',
      model_standard: 'm-std',
      model_deep: 'm-deep',
      daily_standard_limit: 8,
      max_tokens_standard: 900
    })
  })

  it('未知键一律丢弃，缺席字段不进补丁', () => {
    const { ok, patch } = buildConfigPatch({ model_standard: 'm', hacker: 1, admin: true })
    expect(ok).toBe(true)
    expect(patch).toEqual({ model_standard: 'm' })
    expect(buildConfigPatch(null).patch).toEqual({})
    expect(buildConfigPatch({}).patch).toEqual({})
  })

  it('空串显式拒绝（防 Number("")=0 把档位参数写成 0）', () => {
    expect(buildConfigPatch({ model_standard: '  ' }).ok).toBe(false)
    expect(buildConfigPatch({ max_tokens_deep: '' }).ok).toBe(false)
    expect(buildConfigPatch({ daily_deep_limit: '' }).ok).toBe(false)
  })

  it('非法数值拒绝：负数/非有限数', () => {
    expect(buildConfigPatch({ price_deep_in: -1 }).ok).toBe(false)
    expect(buildConfigPatch({ price_deep_in: 'abc' }).ok).toBe(false)
    expect(buildConfigPatch({ daily_standard_limit: -3 }).ok).toBe(false)
  })
})
