import { bearerToken, sendJson } from '../_lib/http.js'
import { getAuthorizedUser } from '../_lib/supabase.js'
import { loadAiConfig, resolveAiConfig } from '../_lib/ai-config.js'

function shanghaiDay() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date())
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: '仅支持 GET' })
  try {
    const access = await getAuthorizedUser(bearerToken(req))
    if (!access.user) return sendJson(res, access.status, { error: access.error })

    let limits = { dailyStandardLimit: 5, dailyDeepLimit: 1 }
    try {
      const resolved = resolveAiConfig(await loadAiConfig(), 'standard')
      if (!resolved.error) {
        limits = { dailyStandardLimit: resolved.dailyStandardLimit, dailyDeepLimit: resolved.dailyDeepLimit }
      }
    } catch {
      // 配置缺失时按默认限额展示，权威校验仍在 chat 预留时进行
    }

    const { error: cleanupError } = await access.client.rpc('cleanup_stale_ai_reservations')
    if (cleanupError) throw new Error('AI 状态清理失败')

    const day = shanghaiDay()
    // 失败的请求不计入当日次数（与预留函数口径一致：pending+succeeded 才占额）
    const { data, error } = await access.client
      .from('ai_usage_events')
      .select('mode')
      .eq('user_id', access.user.id)
      .eq('used_on', day)
      .in('state', ['pending', 'succeeded'])
    if (error) throw new Error('AI 额度查询失败')

    const used = { standard: 0, deep: 0 }
    for (const row of data || []) used[row.mode] = (used[row.mode] || 0) + 1

    return sendJson(res, 200, {
      day,
      standardRemaining: Math.max(0, limits.dailyStandardLimit - (used.standard || 0)),
      deepAvailable: (used.deep || 0) < limits.dailyDeepLimit
    })
  } catch {
    return sendJson(res, 503, { error: 'AI 服务状态暂不可用' })
  }
}
