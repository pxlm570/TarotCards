// AccessView 登录后提示语义（2026-09-28）：刚签发的会话被 /api/auth/me 打回 401 时
// （服务端鉴权配置损坏的实测形态——新鲜 token 打 Supabase /auth/v1/user 200、
// 打线上 auth/me 却 401），必须给出真实原因，而不是渲染「账号已就绪，请输入邀请码」
// 这种正常态文案把用户引去死胡同。403 正常否定态仍维持原引导。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../src/lib/supabase.js', () => ({
  isSupabaseConfigured: true,
  inviteGateRequired: true,
  defaultAIEnabled: false,
  customAIAllowed: false,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(async () => ({
        data: { session: { access_token: 'tok-new', user: { email: 'a@b.c' } } },
        error: null
      }))
    }
  }
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn(async () => {}) })
}))

vi.mock('../src/components/InviteGenerator.vue', () => ({
  default: { name: 'InviteGenerator', template: '<div data-stub="invite-generator" />' }
}))

vi.mock('../src/lib/storage.js', () => ({
  safeGetItem: vi.fn(() => null)
}))

function stubMe(status, body) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  })))
}

async function mountAndSubmit() {
  const { default: AccessView } = await import('../src/views/AccessView.vue')
  const wrapper = mount(AccessView)
  await flushPromises()
  const signinTab = wrapper.findAll('button').find((b) => b.text() === '已有账号')
  await signinTab.trigger('click')
  await wrapper.find('#email').setValue('a@b.c')
  await wrapper.find('#password').setValue('password-8')
  await wrapper.find('form').trigger('submit')
  await flushPromises()
  return wrapper
}

describe('AccessView 登录后提示', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('刚签发的会话被 401 打回 → 提示服务器未确认，而非「请输入邀请码」', async () => {
    stubMe(401, { error: '登录状态已过期，请重新登录', invited: false })
    const wrapper = await mountAndSubmit()
    expect(wrapper.text()).toContain('登录状态没有被服务器确认')
    expect(wrapper.text()).not.toContain('账号已就绪')
    wrapper.unmount()
  })

  it('403 正常否定态 → 维持「账号已就绪」并显示邀请码输入框', async () => {
    stubMe(403, { invited: false, owner: false, email: 'a@b.c' })
    const wrapper = await mountAndSubmit()
    expect(wrapper.text()).toContain('账号已就绪')
    expect(wrapper.find('#invite-code').exists()).toBe(true)
    wrapper.unmount()
  })
})
