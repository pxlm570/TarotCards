// 自绘密码可见性切换（2026-09-28）：浏览器原生「显示密码」键只在聚焦时出现且页面无法
// 控制（门禁页实测输入后消失不可点），根修=PasswordField 自绘常驻按钮。本 spec 守卫：
// 切换键常驻可点、type 在 password/text 间翻转、aria 状态同步、v-model 回传、表单内可用。
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
      onAuthStateChange: vi.fn()
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

describe('PasswordField 自绘可见性切换', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('初始 type=password，点切换变 text，再点翻回，aria 状态同步', async () => {
    const { default: PasswordField } = await import('../src/components/PasswordField.vue')
    const wrapper = mount(PasswordField, { attrs: { placeholder: '至少 8 位' } })
    const input = wrapper.find('input')
    expect(input.attributes('type')).toBe('password')
    expect(input.attributes('placeholder')).toBe('至少 8 位')

    const toggle = wrapper.find('button[aria-label="显示密码"]')
    await toggle.trigger('click')
    expect(input.attributes('type')).toBe('text')
    expect(wrapper.find('button[aria-label="隐藏密码"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-pressed="true"]').exists()).toBe(true)

    await wrapper.find('button[aria-label="隐藏密码"]').trigger('click')
    expect(input.attributes('type')).toBe('password')
    wrapper.unmount()
  })

  it('v-model 双向回传；type=text 下输入的值仍在模型里', async () => {
    const { default: PasswordField } = await import('../src/components/PasswordField.vue')
    const wrapper = mount(PasswordField)
    await wrapper.find('input').setValue('secret-pass-1')
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['secret-pass-1'])
    await wrapper.find('button[aria-label="显示密码"]').trigger('click')
    expect(wrapper.find('input').attributes('type')).toBe('text')
    expect(wrapper.find('input').element.value).toBe('secret-pass-1')
    wrapper.unmount()
  })

  it('type=button 不会触发表单提交；切换键始终存在（输入后不消失）', async () => {
    const { default: PasswordField } = await import('../src/components/PasswordField.vue')
    const wrapper = mount(PasswordField)
    await wrapper.find('input').setValue('abc')
    expect(wrapper.find('button.pw-toggle').exists()).toBe(true)
    expect(wrapper.find('button.pw-toggle').attributes('type')).toBe('button')
    wrapper.unmount()
  })
})

describe('AccessView 密码框接入自绘切换', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('登录表单内密码框带「显示密码」键，输入后仍在且可翻转明文', async () => {
    const { default: AccessView } = await import('../src/views/AccessView.vue')
    const wrapper = mount(AccessView)
    await flushPromises()
    const signinTab = wrapper.findAll('button').find((b) => b.text() === '已有账号')
    await signinTab.trigger('click')
    await wrapper.find('#email').setValue('a@b.c')

    const toggle = wrapper.find('button[aria-label="显示密码"]')
    expect(toggle.exists()).toBe(true)
    await wrapper.find('#password').setValue('password-8')
    expect(wrapper.find('button[aria-label="显示密码"]').exists()).toBe(true)
    expect(wrapper.find('#password').attributes('type')).toBe('password')
    await toggle.trigger('click')
    expect(wrapper.find('#password').attributes('type')).toBe('text')
    wrapper.unmount()
  })
})
