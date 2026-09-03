// 首页顶栏状态胶囊（2026-09-03 多邻国风改版，方案一全彩实底）：
// 火焰连胜（0 走灰态）+ 等级 XP + 帮助；hero 中央牌的连胜徽章随顶栏去重移除。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import HomeView from '../src/views/HomeView.vue'
import { useJournalStore } from '../src/stores/journal.js'
import { useProfileStore } from '../src/stores/profile.js'
import { currentDayKey } from '../src/lib/day-key.js'

// HomeView 与 router/index.js 互相引用（PHASE_ROUTE）：测试 mock 断开循环
vi.mock('../src/router/index.js', () => ({
  PHASE_ROUTE: {
    questioning: '/reading/question',
    shuffling: '/reading/shuffle',
    picking: '/reading/pick',
    revealing: '/reading/reveal',
    interpreting: '/reading/interpretation'
  }
}))
vi.mock('../src/lib/use-deck.js', () => ({
  useDeck: () => ({ cardUrl: () => '', backUrl: () => '' })
}))
vi.mock('../src/lib/feedback.js', () => ({ tap: vi.fn() }))

async function mountHome() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/welcome', component: { template: '<div />' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } }
    ]
  })
  router.push('/')
  await router.isReady()
  return mount(HomeView, { global: { plugins: [router] } })
}

// day-key 相邻日：currentDayKey 本身含凌晨 4 点换日，直接在其返回值上减一历日
function prevDayKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d - 1)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

describe('HomeView：顶栏状态胶囊', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('连胜 0：火焰走灰态，数字为 0', async () => {
    const wrapper = await mountHome()
    const fire = wrapper.find('.pill.fire')
    expect(fire.classes()).toContain('cold')
    expect(fire.text()).toBe('0')
  })

  it('连胜 2：火焰亮态显示天数，hero 中央牌不再挂连胜徽章（去重）', async () => {
    const journal = useJournalStore()
    const today = currentDayKey()
    journal.dailyDraws = { [today]: 'r1', [prevDayKey(today)]: 'r2' }
    const wrapper = await mountHome()

    const fire = wrapper.find('.pill.fire')
    expect(fire.classes()).not.toContain('cold')
    expect(fire.text()).toBe('2')
    expect(wrapper.find('.streak-badge').exists()).toBe(false)
  })

  it('等级胶囊显示 Lv 与大阿尔卡纳名（XP 0 → Lv.1 愚人）', async () => {
    const wrapper = await mountHome()
    const xp = wrapper.find('.pill.xp')
    expect(xp.text()).toContain('Lv.1')
    expect(xp.text()).toContain('愚人')
  })

  it('帮助圆块仍是重看引导入口', async () => {
    const wrapper = await mountHome()
    expect(wrapper.find('.pill.help').exists()).toBe(true)
  })
})
