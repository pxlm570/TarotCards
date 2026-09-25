import { bearerToken, sendJson } from '../_lib/http.js'
import { getAuthorizedUser } from '../_lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: '仅支持 GET' })
  try {
    const result = await getAuthorizedUser(bearerToken(req))
    if (!result.user) return sendJson(res, result.status, { error: result.error, invited: false })
    return sendJson(res, 200, { invited: true, email: result.user.email })
  } catch {
    return sendJson(res, 503, { error: '访问服务暂不可用' })
  }
}
