// 站长台入口视觉收口（2026-09-29 用户拍板）：非站长打开 /admin 不再看到「仅站长
// 可访问」空态页，而是直接弹回应用首页（数据本就被服务端 owner 门禁 403 挡住，
// 这里只是不渲染空壳）。站长本人正常渲染三页导航壳。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const replace = vi.fn(async () => {})

vi.mock('vue-router', () => ({
  RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' },
  RouterView: { name: 'RouterView', template: '<div data-stub="router-view" />' },
  useRouter: () => ({ replace })
}))

vi.mock('../src/lib/supabase.js', () => ({
  isSupabaseConfigured: true,
  inviteGateRequired: true,
  defaultAIEnabled: false,
  customAIAllowed: false,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn()
    }
  }
}))

async function mountLayout() {
  vi.resetModules()
  const { default: AdminLayout } = await import('../src/components/AdminLayout.vue')
  return mount(AdminLayout)
}

describe('AdminLayout 站长入口收口', () => {
  beforeEach(() => {
    replace.mockClear()
    setActivePinia(createPinia())
  })

  it('非站长（active 但 owner=false）→ 弹回 / 且不渲染壳', async () => {
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    auth.state = 'active'
    auth.owner = false
    const wrapper = await mountLayout()
    await Promise.resolve()
    expect(replace).toHaveBeenCalledWith('/')
    expect(wrapper.find('.adm-shell').exists()).toBe(false)
    wrapper.unmount()
  })

  it('站长（owner=true）→ 正常渲染壳与导航，不弹回', async () => {
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    auth.state = 'active'
    auth.owner = true
    const wrapper = await mountLayout()
    await Promise.resolve()
    expect(replace).not.toHaveBeenCalled()
    expect(wrapper.find('.adm-shell').exists()).toBe(true)
    expect(wrapper.findAll('.adm-nav a').map((a) => a.text())).toEqual(['数据看板', 'AI 配置', '邀请码'])
    wrapper.unmount()
  })
})
