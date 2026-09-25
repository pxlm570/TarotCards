import { createHash } from 'node:crypto'
import { bearerToken, readJson, sendJson } from '../_lib/http.js'
import { getServiceClient } from '../_lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: '仅支持 POST' })
  try {
    const token = bearerToken(req)
    if (!token) return sendJson(res, 401, { error: '请先登录' })
    const body = await readJson(req, 4096)
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    if (!/^[A-Z0-9-]{12,40}$/.test(code)) return sendJson(res, 400, { error: '邀请码格式无效' })

    const client = getServiceClient()
    const { data: auth, error: authError } = await client.auth.getUser(token)
    if (authError || !auth.user) return sendJson(res, 401, { error: '登录状态已过期，请重新登录' })
    const codeHash = createHash('sha256').update(code).digest('hex')
    const { data, error } = await client.rpc('redeem_beta_invite', {
      p_user_id: auth.user.id,
      p_code_hash: codeHash
    })
    if (error) throw new Error('邀请码服务暂不可用')
    if (!data?.redeemed) return sendJson(res, 400, { error: '邀请码无效、已过期或已使用' })
    return sendJson(res, 200, { invited: true })
  } catch (error) {
    return sendJson(res, error.statusCode || 503, { error: error.statusCode ? error.message : '邀请码服务暂不可用' })
  }
}
