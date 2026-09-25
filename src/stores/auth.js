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

export const useAuthStore = defineStore('auth', () => {
  const required = inviteGateRequired
  const state = ref(required ? 'loading' : 'open')
  const session = ref(null)
  const email = ref('')
  const error = ref('')
  let initialized = false
  let initialization = null

  async function updateAccess(nextSession) {
    session.value = nextSession
    email.value = nextSession?.user?.email || ''
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
      const access = await requestJson('/api/auth/me', nextSession)
      state.value = access.invited ? 'active' : 'invite-needed'
    } catch {
      state.value = 'service-error'
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

  return { required, state, session, email, error, initialize, signUp, signIn, redeem, signOut }
})
