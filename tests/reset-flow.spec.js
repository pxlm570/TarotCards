// 密码找回流程（2026-09-29 SMTP 根治配套）：门禁页「忘记密码」入口发重置邮件
// （redirectTo 不带 hash，落到根路径由 supabase-js 消费）、未确认邮箱可重发确认、
// /reset-password 落地页设置新密码并在成功后清除 recovering 标志。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// 工厂读外部可变对象（vi.mock 工厂不会随 resetModules 重跑，跨测试改这里）
const stub = {
  signInError: null,
  resetError: null,
  resetCalls: [],
  resendError: null,
  resendCalls: [],
  updateUserError: null,
  updateUserCalls: []
}

vi.mock('../src/lib/supabase.js', () => ({
  isSupabaseConfigured: true,
  inviteGateRequired: true,
  defaultAIEnabled: false,
  customAIAllowed: false,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(async () => (stub.signInError ? { data: {}, error: stub.signInError } : {
        data: { session: { access_token: 'tok', user: { email: 'a@b.c' } } }, error: null
      })),
      resetPasswordForEmail: vi.fn(async (email, options) => {
        stub.resetCalls.push({ email, options })
        return stub.resetError ? { error: stub.resetError } : { data: {}, error: null }
      }),
      resend: vi.fn(async (payload) => {
        stub.resendCalls.push(payload)
        return stub.resendError ? { error: stub.resendError } : { data: {}, error: null }
      }),
      updateUser: vi.fn(async (attrs) => {
        stub.updateUserCalls.push(attrs)
        return stub.updateUserError ? { error: stub.updateUserError } : { data: {}, error: null }
      })
    }
  }
}))

const replace = vi.fn(async () => {})
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {}, name: 'test' }),
  useRouter: () => ({ replace }),
  RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' },
  RouterView: { name: 'RouterView', template: '<div data-stub="router-view" />' }
}))

vi.mock('../src/components/InviteGenerator.vue', () => ({
  default: { name: 'InviteGenerator', template: '<div data-stub="invite-generator" />' }
}))

vi.mock('../src/lib/storage.js', () => ({
  safeGetItem: vi.fn(() => null)
}))

async function mountAccess() {
  const { default: AccessView } = await import('../src/views/AccessView.vue')
  const wrapper = mount(AccessView)
  await flushPromises()
  const signinTab = wrapper.findAll('button').find((b) => b.text() === '已有账号')
  await signinTab.trigger('click')
  await wrapper.find('#email').setValue('a@b.c')
  return wrapper
}

describe('AccessView 忘记密码与确认重发', () => {
  beforeEach(() => {
    vi.resetModules()
    stub.signInError = null
    stub.resetError = null
    stub.resetCalls.length = 0
    stub.resendError = null
    stub.resendCalls.length = 0
    stub.updateUserError = null
    stub.updateUserCalls.length = 0
    replace.mockClear()
    setActivePinia(createPinia())
  })

  it('登录态出现「忘记密码」入口；未填邮箱给出引导提示', async () => {
    const wrapper = await mountAccess()
    await wrapper.find('#email').setValue('')
    const forgot = wrapper.findAll('button').find((b) => b.text() === '忘记密码？')
    expect(forgot).toBeTruthy()
    await forgot.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('先在上面填好你的注册邮箱')
    expect(stub.resetCalls).toHaveLength(0)
    wrapper.unmount()
  })

  it('填了邮箱点忘记密码 → 发重置邮件且 redirectTo 不带 hash', async () => {
    const wrapper = await mountAccess()
    const forgot = wrapper.findAll('button').find((b) => b.text() === '忘记密码？')
    await forgot.trigger('click')
    await flushPromises()
    expect(stub.resetCalls).toHaveLength(1)
    expect(stub.resetCalls[0].email).toBe('a@b.c')
    expect(stub.resetCalls[0].options.redirectTo).not.toContain('#')
    expect(wrapper.text()).toContain('重置邮件已发送')
    wrapper.unmount()
  })

  it('登录遇到「Email not confirmed」→ 中文提示 + 重发按钮，点击重发', async () => {
    stub.signInError = { message: 'Email not confirmed' }
    const wrapper = await mountAccess()
    await wrapper.find('#password').setValue('password-8')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('还没完成确认')
    const resend = wrapper.findAll('button').find((b) => b.text().includes('重新发送确认邮件'))
    expect(resend).toBeTruthy()
    await resend.trigger('click')
    await flushPromises()
    expect(stub.resendCalls).toEqual([{ type: 'signup', email: 'a@b.c' }])
    expect(wrapper.text()).toContain('确认邮件已重发')
    wrapper.unmount()
  })

  it('密码错误的中文化映射', async () => {
    stub.signInError = { message: 'Invalid login credentials' }
    const wrapper = await mountAccess()
    await wrapper.find('#password').setValue('password-8')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('邮箱或密码不正确')
    wrapper.unmount()
  })
})

describe('ResetPasswordView 设置新密码', () => {
  beforeEach(() => {
    vi.resetModules()
    stub.updateUserError = null
    stub.updateUserCalls.length = 0
    replace.mockClear()
    setActivePinia(createPinia())
  })

  async function mountReset() {
    const { default: ResetPasswordView } = await import('../src/views/ResetPasswordView.vue')
    return mount(ResetPasswordView)
  }

  it('signed-out 直开（链接失效）→ 如实提示', async () => {
    // 生产里守卫已跑过 initialize：无会话时 state=signed-out
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    auth.state = 'signed-out'
    const wrapper = await mountReset()
    await flushPromises()
    expect(wrapper.text()).toContain('重置链接无效或已过期')
    wrapper.unmount()
  })

  it('两次密码不一致 → 本地校验拦截，不调接口', async () => {
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    auth.recovering = true
    const wrapper = await mountReset()
    await wrapper.find('#new-password').setValue('password-8')
    await wrapper.find('#confirm-password').setValue('password-9')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('两次输入的密码不一致')
    expect(stub.updateUserCalls).toHaveLength(0)
    wrapper.unmount()
  })

  it('成功路径：updateUser 收到新密码、recovering 清零、去登录页', async () => {
    const { useAuthStore } = await import('../src/stores/auth.js')
    const auth = useAuthStore()
    auth.recovering = true
    const wrapper = await mountReset()
    await wrapper.find('#new-password').setValue('password-8')
    await wrapper.find('#confirm-password').setValue('password-8')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(stub.updateUserCalls).toEqual([{ password: 'password-8' }])
    expect(auth.recovering).toBe(false)
    expect(replace).toHaveBeenCalledWith('/access')
    wrapper.unmount()
  })
})
