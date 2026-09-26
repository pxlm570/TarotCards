import { defineStore } from 'pinia'
import { ref } from 'vue'
import { inviteGateRequired, isSupabaseConfigured, supabase } from '../lib/supabase.js'

async function requestJson(path, session, payload) {
  const response = await fetch(path, {
    method: payload ? 'POST' : 'GET',
    headers: {
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
    },
    ...(payload ? { body: JSON.stringify(payload) } : {})
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || '请求失败，请稍后再试。')
  return data
}

// 会话状态查询专用（2026-09-26 修注册断点）：/api/auth/me 的 403 invited:false
// 是「已登录未兑换成员」的正常语义（要引流到邀请码页），不是服务故障——
// 此前与网络错误、5xx 混为一谈，新用户全部卡在 service-error 红字。
async function requestAccess(session) {
  const response = await fetch('/api/auth/me', {
    headers: {
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
    }
  })
  const data = await response.json().catch(() => ({}))
  if (response.status === 401) {
    throw Object.assign(new Error('登录状态已过期'), { authExpired: true })
  }
  if (response.status >= 500) throw new Error(data.error || '访问服务暂不可用')
  return data
}

export const useAuthStore = defineStore('auth', () => {
  const required = inviteGateRequired
  const state = ref(required ? 'loading' : 'open')
  const session = ref(null)
  const email = ref('')
  const owner = ref(false)
  const error = ref('')
  let initialized = false
  let initialization = null

  async function updateAccess(nextSession) {
    session.value = nextSession
    email.value = nextSession?.user?.email || ''
    owner.value = false
    if (!required) {
      state.value = 'open'
      return
    }
    if (!nextSession) {
      state.value = 'signed-out'
      return
    }
    state.value = 'checking'
    try {
      const access = await requestAccess(nextSession)
      owner.value = Boolean(access.owner)
      state.value = access.invited ? 'active' : 'invite-needed'
    } catch (error) {
      state.value = error?.authExpired ? 'signed-out' : 'service-error'
    }
  }

  async function initialize() {
    if (initialized) return
    if (initialization) return initialization
    initialization = (async () => {
      if (!required) {
        state.value = 'open'
        initialized = true
        return
      }
      if (!isSupabaseConfigured) {
        state.value = 'config-error'
        initialized = true
        return
      }
      try {
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          state.value = 'service-error'
        } else {
          await updateAccess(data.session)
        }
        supabase.auth.onAuthStateChange((_event, nextSession) => {
          // Do not await network work inside Supabase's auth callback.
          queueMicrotask(() => updateAccess(nextSession))
        })
      } catch {
        state.value = 'service-error'
      }
      initialized = true
    })()
    return initialization
  }

  async function signUp({ email: address, password }) {
    if (!supabase) throw new Error('登录服务尚未配置。')
    error.value = ''
    const { data, error: signUpError } = await supabase.auth.signUp({ email: address.trim(), password })
    if (signUpError) throw signUpError
    await updateAccess(data.session)
    return data
  }

  async function signIn({ email: address, password }) {
    if (!supabase) throw new Error('登录服务尚未配置。')
    error.value = ''
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: address.trim(), password })
    if (signInError) throw signInError
    await updateAccess(data.session)
    return data
  }

  async function redeem(code) {
    if (!session.value) throw new Error('请先登录或创建账号。')
    const result = await requestJson('/api/invite/redeem', session.value, { code })
    await updateAccess(session.value)
    return result
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    await updateAccess(null)
  }

  return { required, state, session, email, owner, error, initialize, signUp, signIn, redeem, signOut }
})
