// 站长专属端点的公共门禁（2026-09-25）：邀请成员 + 邮箱等于 ADMIN_EMAIL 双重校验。
// ADMIN_EMAIL 未配置时整个管理面禁用（503），前端据此隐藏入口，普通用户不可见。
import { bearerToken } from './http.js'
import { getAuthorizedUser } from './supabase.js'

export async function requireOwner(req) {
  const access = await getAuthorizedUser(bearerToken(req))
  if (!access.user) return { status: access.status, error: access.error }
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  if (!adminEmail) return { status: 503, error: '管理功能未启用' }
  const email = (access.user.email || '').trim().toLowerCase()
  if (email !== adminEmail) return { status: 403, error: '仅站长可访问' }
  return access
}
