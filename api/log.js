// 匿名产品统计上报（2026-09-26 用户拍板）：只收页面路径与功能使用次数，
// 绝不收占卜内容。事件名走服务端白名单，仅受邀成员的上报会入库。
import { bearerToken, readJson, sendJson } from '../_lib/http.js'
import { getAuthorizedUser } from '../_lib/supabase.js'

const ALLOWED_EVENTS = new Set([
  'page_view',
  'reading_complete',
  'daily_draw',
  'lesson_complete',
  'practice_complete',
  'share_card'
])
const MAX_EVENTS = 50

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: '仅支持 POST' })
  try {
    const access = await getAuthorizedUser(bearerToken(req))
    if (!access.user) return sendJson(res, access.status, { error: access.error })

    const body = await readJson(req, 16 * 1024).catch(() => ({}))
    const events = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS) : []
    const rows = []
    for (const event of events) {
      if (!event || !ALLOWED_EVENTS.has(event.name)) continue
      rows.push({
        user_id: access.user.id,
        name: event.name,
        path: typeof event.path === 'string' && event.path ? event.path.slice(0, 120) : null
      })
    }
    if (!rows.length) return sendJson(res, 200, { accepted: 0 })

    const { error } = await access.client.from('app_events').insert(rows)
    if (error) return sendJson(res, 503, { error: '统计写入失败' })
    return sendJson(res, 200, { accepted: rows.length })
  } catch {
    return sendJson(res, 503, { error: '统计服务暂不可用' })
  }
}
