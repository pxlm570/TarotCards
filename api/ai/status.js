import { bearerToken, sendJson } from '../_lib/http.js'
import { getAuthorizedUser } from '../_lib/supabase.js'

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
    const { error: cleanupError } = await access.client.rpc('cleanup_stale_ai_reservations')
    if (cleanupError) throw new Error('AI 状态清理失败')
    const day = shanghaiDay()
    const { data, error } = await access.client
      .from('deep_reading_daily')
      .select('user_id')
      .eq('user_id', access.user.id)
      .eq('used_on', day)
      .maybeSingle()
    if (error) throw new Error('深度解读额度查询失败')
    return sendJson(res, 200, { deepAvailable: !data, day })
  } catch {
    return sendJson(res, 503, { error: 'AI 服务状态暂不可用' })
  }
}
