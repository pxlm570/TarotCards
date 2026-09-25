import { createClient } from '@supabase/supabase-js'

let serviceClient

export function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase 服务端环境变量未配置')
  if (!serviceClient) {
    serviceClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  }
  return serviceClient
}

export async function getAuthorizedUser(token) {
  if (!token) return { error: '请先登录', status: 401 }
  const client = getServiceClient()
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return { error: '登录状态已过期，请重新登录', status: 401 }
  const { data: member, error: memberError } = await client
    .from('beta_members')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle()
  if (memberError) throw new Error('Supabase 邀请权限查询失败')
  if (!member) return { error: '该账号尚未兑换有效邀请码', status: 403 }
  return { user: data.user, client }
}
