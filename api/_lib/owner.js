// 站长专属端点的公共门禁（2026-09-26 收口；2026-09-29 升级白名单）：
// 有效登录态 + 邮箱在站长白名单内。白名单 = ADMIN_EMAILS（逗号/分号/空白分隔
// 多个邮箱）∪ 旧 ADMIN_EMAIL 单值（向后兼容），都未配置时整个管理面禁用（503）。
// 刻意不要求 beta_members 成员身份——站长首个邀请码要靠本门禁生成（自助引导），
// 若先要求成员会形成「要成员才能发码、要码才能成成员」的死结。
import { bearerToken } from './http.js'
import { getServiceClient } from './supabase.js'

export function ownerEmails(env = process.env) {
  // 分隔符含全角逗号/分号（中文输入法易混入）；旧 ADMIN_EMAIL 排首位（主站长在前）
  const raw = `${env.ADMIN_EMAIL || ''},${env.ADMIN_EMAILS || ''}`
  return [...new Set(
    raw
      .split(/[,;，；\s]+/u)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  )]
}

export async function requireOwner(req) {
  const token = bearerToken(req)
  if (!token) return { status: 401, error: '请先登录' }
  const client = getServiceClient()
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return { status: 401, error: '登录状态已过期，请重新登录' }
  const owners = ownerEmails()
  if (!owners.length) return { status: 503, error: '管理功能未启用' }
  const email = (data.user.email || '').trim().toLowerCase()
  if (!owners.includes(email)) return { status: 403, error: '仅站长可访问' }
  return { user: data.user, client }
}
