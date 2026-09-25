// 站长 GUI 配置端点（2026-09-25 用户要求表单化，替代/并存于 npm run ai:config）：
// GET 返回脱敏配置与缺口清单，POST 白名单合并保存（不整行覆盖，api_key 留空=不改）。
// 门禁见 _lib/owner.js——普通成员拿到 403，前端据此不渲染表单。
import { bearerToken, readJson, sendJson } from '../_lib/http.js'
import { requireOwner } from '../_lib/owner.js'
import {
  AI_CONFIG_KEY,
  normalizeAiConfig,
  missingAiConfigFields,
  maskApiKey,
  buildConfigPatch
} from '../_lib/ai-config.js'

async function readConfigRow(client) {
  const { data, error } = await client
    .from('app_config')
    .select('value, updated_at')
    .eq('key', AI_CONFIG_KEY)
    .maybeSingle()
  if (error) throw new Error('配置读取失败')
  return { value: data?.value ?? null, updatedAt: data?.updated_at ?? null }
}

function maskedConfig(config) {
  return { ...config, api_key: maskApiKey(config.api_key), has_api_key: Boolean(config.api_key) }
}

export default async function handler(req, res) {
  try {
    const access = await requireOwner(req)
    if (access.status) return sendJson(res, access.status, { error: access.error })

    if (req.method === 'GET') {
      const { value, updatedAt } = await readConfigRow(access.client)
      const config = normalizeAiConfig(value)
      return sendJson(res, 200, {
        config: maskedConfig(config),
        missing: missingAiConfigFields(config),
        updated_at: updatedAt
      })
    }

    if (req.method === 'POST') {
      const body = await readJson(req, 8192)
      const { ok, patch, error } = buildConfigPatch(body?.patch ?? body)
      if (!ok) return sendJson(res, 400, { error })
      const { value } = await readConfigRow(access.client)
      const merged = normalizeAiConfig({ ...normalizeAiConfig(value), ...patch })
      const missing = missingAiConfigFields(merged)
      if (missing.length) return sendJson(res, 400, { error: `配置不完整，还缺：${missing.join('、')}` })
      const { error: upsertError } = await access.client
        .from('app_config')
        .upsert({ key: AI_CONFIG_KEY, value: merged, updated_at: new Date().toISOString() })
      if (upsertError) return sendJson(res, 503, { error: '配置保存失败' })
      return sendJson(res, 200, { config: maskedConfig(merged), missing: [] })
    }

    return sendJson(res, 405, { error: '仅支持 GET/POST' })
  } catch (error) {
    return sendJson(res, error.statusCode || 503, {
      error: error.statusCode ? error.message : '配置服务暂不可用'
    })
  }
}
