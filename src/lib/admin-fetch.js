// 站长接口共用取数（2026-09-28 admin 区拆分时收口）：带 Supabase 会话 token，
// 401/403/503 统一返回状态由页面自行分流（denied/error），不在此处弹 toast。
import { supabase } from './supabase.js'

export async function adminFetch(path, options = {}) {
  try {
    // supabase 未配置（本地静态开发）时 getSession 不可用——统一按未登录处理
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) return { status: 401, body: {} }
    const res = await fetch(path, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    const body = await res.json().catch(() => ({}))
    return { status: res.status, body }
  } catch {
    return { status: 0, body: {} }
  }
}
