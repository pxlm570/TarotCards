// 站长专属端点的公共门禁（2026-09-26 收口）：有效登录态 + 邮箱等于 ADMIN_EMAIL。
// 刻意不要求 beta_members 成员身份——站长首个邀请码要靠本门禁生成（自助引导），
// 若先要求成员会形成「要成员才能发码、要码才能成成员」的死结。
// ADMIN_EMAIL 未配置时整个管理面禁用（503），前端据此隐藏入口。
import { bearerToken } from './http.js'
import { getServiceClient } from './supabase.js'

export async function requireOwner(req) {
  const token = bearerToken(req)
  if (!token) return { status: 401, error: '请先登录' }
  const client = getServiceClient()
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return { status: 401, error: '登录状态已过期，请重新登录' }
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  if (!adminEmail) return { status: 503, error: '管理功能未启用' }
  const email = (data.user.email || '').trim().toLowerCase()
  if (email !== adminEmail) return { status: 403, error: '仅站长可访问' }
  return { user: data.user, client }
}
