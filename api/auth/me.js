import { bearerToken, sendJson } from '../_lib/http.js'
import { getServiceClient } from '../_lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: '仅支持 GET' })
  try {
    // 不走 getAuthorizedUser：未兑换成员的站长也要拿到 owner 标志（门禁页据此
    // 显示「生成首个邀请码」自助入口），成员与否单独判断。
    const client = getServiceClient()
    const { data, error } = await client.auth.getUser(bearerToken(req))
    if (error || !data.user) return sendJson(res, 401, { error: '登录状态已过期，请重新登录', invited: false })

    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
    const email = (data.user.email || '').trim().toLowerCase()
    const owner = Boolean(adminEmail) && email === adminEmail

    const { data: member, error: memberError } = await client
      .from('beta_members')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle()
    if (memberError) throw new Error('Supabase 邀请权限查询失败')

    if (!member) return sendJson(res, 403, { invited: false, owner, email })
    return sendJson(res, 200, { invited: true, owner, email })
  } catch {
    return sendJson(res, 503, { error: '访问服务暂不可用' })
  }
}
