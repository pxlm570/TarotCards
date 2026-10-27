// 路由层（src/router/index.js）首个专属测试（2026-10-24 补最大空缺）：
// 只验证守卫的既有语义——首次引导重定向、占卜动线阶段归位、动态 import 失败自救、
// page_view 埋点与门禁烟测（真实 auth store + supabase 未配置 → config-error），
// 不改动 auth/门禁任何行为。
// isolate:false 坑位：markVisited 的 visitedFallback 是模块级状态，必须每例
// resetModules 取全新副本；supabase mock 用工厂 getter 提供活值（telemetry.spec 同款）；
// HomeView ↔ router 循环引用用 mock 断开（home-topbar.spec 同款）。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const trackMock = vi.hoisted(() => vi.fn())
const supaFlags = vi.hoisted(() => ({ gate: false }))

vi.mock('../src/lib/telemetry.js', () => ({ track: trackMock }))
vi.mock('../src/lib/supabase.js', () => ({
  get inviteGateRequired() { return supaFlags.gate },
  isSupabaseConfigured: false,
  defaultAIEnabled: false,
  customAIAllowed: false,
  supabase: null
}))
vi.mock('../src/views/HomeView.vue', () => ({ default: { name: 'HomeStub', template: '<div />' } }))
vi.mock('../src/views/AccessView.vue', () => ({ default: { name: 'AccessStub', template: '<div />' } }))

// 每例全新路由模块（visitedFallback 归零）+ 全新 pinia（reading store 归 idle、auth 归未初始化）
async function freshCtx() {
  vi.resetModules()
  localStorage.clear()
  sessionStorage.clear()
  const piniaMod = await import('pinia')
  piniaMod.setActivePinia(piniaMod.createPinia())
  const routerMod = await import('../src/router/index.js')
  const router = routerMod.createAppRouter()
  const { useReadingStore } = await import('../src/stores/reading.js')
  return { routerMod, router, useReadingStore }
}

async function go(router, path) {
  await router.push(path).catch(() => {})
  return router.currentRoute.value
}

beforeEach(() => {
  supaFlags.gate = false
  trackMock.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('router：导出常量', () => {
  it('PHASE_ROUTE 把五个流程阶段映射到 /reading/* 五个步骤', async () => {
    const { routerMod } = await freshCtx()
    expect(routerMod.PHASE_ROUTE).toEqual({
      questioning: '/reading/question',
      shuffling: '/reading/shuffle',
      picking: '/reading/pick',
      revealing: '/reading/reveal',
      interpreting: '/reading/interpretation'
    })
  })

  it('VISITED_KEY 是引导标记的存储键', async () => {
    const { routerMod } = await freshCtx()
    expect(routerMod.VISITED_KEY).toBe('tarot.visited.v1')
  })
})

describe('router：首次启动引导重定向', () => {
  it('未访问过：常规路由弹回 /welcome', async () => {
    const { router } = await freshCtx()
    expect((await go(router, '/profile')).path).toBe('/welcome')
  })

  it('未访问过：/welcome 本身放行', async () => {
    const { router } = await freshCtx()
    expect((await go(router, '/welcome')).path).toBe('/welcome')
  })

  it('markVisited 写入标记后不再弹引导，常规路由放行', async () => {
    const { routerMod, router } = await freshCtx()
    expect(localStorage.getItem(routerMod.VISITED_KEY)).toBeNull()
    routerMod.markVisited()
    expect(localStorage.getItem(routerMod.VISITED_KEY)).toBe('1')
    expect((await go(router, '/profile')).path).toBe('/profile')
    expect((await go(router, '/')).path).toBe('/')
  })
})

describe('router：占卜动线守卫', () => {
  it('无进行中占卜：四个步骤直链弹回首页', async () => {
    const { routerMod, router } = await freshCtx()
    routerMod.markVisited()
    for (const path of ['/reading/shuffle', '/reading/pick', '/reading/reveal', '/reading/interpretation']) {
      expect((await go(router, path)).path).toBe('/')
    }
  })

  it('question 不带入口参数且无进行中占卜：回首页', async () => {
    const { routerMod, router } = await freshCtx()
    routerMod.markVisited()
    expect((await go(router, '/reading/question')).path).toBe('/')
  })

  it('question 携带 ?spread= / ?daily=1 是动线入口：无进行中占卜也放行', async () => {
    const { routerMod, router } = await freshCtx()
    routerMod.markVisited()
    const withSpread = await go(router, '/reading/question?spread=time-flow')
    expect(withSpread.path).toBe('/reading/question')
    expect(withSpread.query).toEqual({ spread: 'time-flow' })
    const withDaily = await go(router, '/reading/question?daily=1')
    expect(withDaily.path).toBe('/reading/question')
    expect(withDaily.query).toEqual({ daily: '1' })
  })

  it('阶段与步骤不符（改 URL 刷新）：重定向到当前阶段对应步骤', async () => {
    const { routerMod, router, useReadingStore } = await freshCtx()
    routerMod.markVisited()
    useReadingStore().$patch({ phase: 'shuffling' })
    expect((await go(router, '/reading/pick')).path).toBe('/reading/shuffle')
    expect((await go(router, '/reading/interpretation')).path).toBe('/reading/shuffle')
  })

  it('阶段与步骤一致：放行（question 与 interpretation 两端）', async () => {
    const { routerMod, router, useReadingStore } = await freshCtx()
    routerMod.markVisited()
    useReadingStore().$patch({ phase: 'questioning' })
    expect((await go(router, '/reading/question')).path).toBe('/reading/question')
    useReadingStore().$patch({ phase: 'interpreting' })
    expect((await go(router, '/reading/interpretation')).path).toBe('/reading/interpretation')
  })

  it('非五阶段（spreadSelected）不在阶段映射内：只要有进行中占卜即放行', async () => {
    const { routerMod, router, useReadingStore } = await freshCtx()
    routerMod.markVisited()
    useReadingStore().$patch({ phase: 'spreadSelected' })
    expect((await go(router, '/reading/pick')).path).toBe('/reading/pick')
  })
})

describe('router：错误自救与 page_view 埋点', () => {
  it('动态 import 失败类错误触发 location.reload（旧 hash chunk 被 SW 清掉的自救）', async () => {
    const { routerMod, router } = await freshCtx()
    routerMod.markVisited()
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    router.beforeEach(() => { throw new Error('Failed to fetch dynamically imported module: /assets/index-abc.js') })
    try {
      await expect(router.push('/profile')).rejects.toThrow('Failed to fetch dynamically imported')
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('其他导航错误不触发整页刷新', async () => {
    const { routerMod, router } = await freshCtx()
    routerMod.markVisited()
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    router.beforeEach(() => { throw new Error('boom: unrelated guard failure') })
    try {
      await expect(router.push('/profile')).rejects.toThrow('unrelated guard failure')
      expect(reload).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('afterEach 按最终路径上报 page_view', async () => {
    const { routerMod, router } = await freshCtx()
    routerMod.markVisited()
    await go(router, '/profile')
    expect(trackMock).toHaveBeenCalledWith('page_view', '/profile')
    trackMock.mockClear()
    await go(router, '/')
    expect(trackMock).toHaveBeenCalledWith('page_view', '/')
  })

  it('未访问过时重定向只记终点 /welcome，不记中途目标', async () => {
    const { router } = await freshCtx()
    await go(router, '/profile')
    expect(trackMock).toHaveBeenCalledTimes(1)
    expect(trackMock).toHaveBeenCalledWith('page_view', '/welcome')
  })
})

describe('router：邀请门禁开启（真实 auth store 烟测，语义不动）', () => {
  it('门禁开启且 supabase 未配置：任意路由弹回 /access 并携带 next（门禁先于引导判定）', async () => {
    supaFlags.gate = true
    const { router } = await freshCtx()
    const r = await go(router, '/profile')
    expect(r.name).toBe('access')
    expect(r.query.next).toBe('/profile')
  })

  it('/access 自身放行且不带 next', async () => {
    supaFlags.gate = true
    const { routerMod, router } = await freshCtx()
    routerMod.markVisited()
    const r = await go(router, '/access')
    expect(r.name).toBe('access')
    expect(r.query.next).toBeUndefined()
  })
})
