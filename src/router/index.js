// hash 路由（接手定案）：GitHub Pages 子路径下 HTML5 history 刷新/深链 404，
// hash 模式零配置可靠；M4 的 #import= 配置链接在 main.js 挂载路由前拦截，互不冲突。
import { createRouter, createWebHashHistory } from 'vue-router'
import { useReadingStore } from '../stores/reading.js'
import { safeGetItem, safeSetItem } from '../lib/storage.js'
import HomeView from '../views/HomeView.vue'

const VISITED_KEY = 'tarot.visited.v1'

// localStorage 不可用（iOS 阻止所有 Cookie / 配额满）时的会话级兜底：
// 读失败按「已访问」处理、写失败靠内存标记，避免引导页重定向死锁
let visitedFallback = false

export function markVisited() {
  visitedFallback = true
  safeSetItem(VISITED_KEY, '1')
}

function hasVisited() {
  if (visitedFallback) return true
  try {
    return localStorage.getItem(VISITED_KEY) !== null
  } catch {
    return true // 存储被禁：跳过强制引导，保应用可用
  }
}

// 占卜动线：阶段 ↔ 路由步骤映射（守卫据此把误入的步骤重定向到当前阶段）
const PHASE_ROUTE = {
  questioning: '/reading/question',
  shuffling: '/reading/shuffle',
  picking: '/reading/pick',
  revealing: '/reading/reveal',
  interpreting: '/reading/interpretation'
}

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/welcome', name: 'welcome', component: () => import('../views/WelcomeView.vue') },
  // 首页 hero 三方向样张舞台（2026-09-01 仅供定稿预览，不入任何导航；定稿后随实现一并清理）
  { path: '/hero-samples', name: 'hero-samples', component: () => import('../views/HeroSamplesView.vue') },
  // 选牌阵独立页（Task 21）：刻意放在 /reading/* 之外——守卫会把无进行中占卜的 /reading/* 直链弹回首页
  { path: '/spreads', name: 'spreads', component: () => import('../views/SpreadSelectView.vue') },
  // 自定义牌阵编辑器（v1.5 Task 5）：同样放 /reading/* 之外
  { path: '/spread-editor', name: 'spread-editor', component: () => import('../views/SpreadEditorView.vue') },
  { path: '/learn', name: 'learn', component: () => import('../views/LearnView.vue') },
  { path: '/learn/review', name: 'learn-review', component: () => import('../views/learn/ReviewView.vue') },
  { path: '/learn/challenge', name: 'learn-challenge', component: () => import('../views/learn/DailyChallengeView.vue') },
  { path: '/learn/:chapterId', name: 'chapter', component: () => import('../views/learn/ChapterView.vue') },
  { path: '/learn/:chapterId/:lessonId', name: 'lesson', component: () => import('../views/learn/LessonView.vue') },
  { path: '/deck', name: 'deck', component: () => import('../views/DeckView.vue') },
  { path: '/deck/:cardId', name: 'card', component: () => import('../views/CardDetailView.vue') },
  // 牌面鉴赏收藏馆（v1.5 Task 8）：入口在「我的」与牌库页，不占 TabBar
  { path: '/collection', name: 'collection', component: () => import('../views/CollectionView.vue') },
  { path: '/journal', name: 'journal', component: () => import('../views/JournalView.vue') },
  { path: '/journal/:readingId', name: 'reading-detail', component: () => import('../views/ReadingDetailView.vue') },
  { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
  // 「我的」详情页（v1.5 收缩重构）：主页只留条目，详细选择进独立页
  { path: '/profile/birth', name: 'profile-birth', component: () => import('../views/profile/BirthView.vue') },
  { path: '/profile/appearance', name: 'profile-appearance', component: () => import('../views/profile/AppearanceView.vue') },
  { path: '/profile/preference', name: 'profile-preference', component: () => import('../views/profile/PreferenceView.vue') },
  { path: '/profile/ai', name: 'profile-ai', component: () => import('../views/profile/AiView.vue') },
  { path: '/profile/data', name: 'profile-data', component: () => import('../views/profile/DataView.vue') },
  { path: '/profile/about', name: 'profile-about', component: () => import('../views/profile/AboutView.vue') },
  { path: '/reading/question', name: 'question', component: () => import('../views/reading/QuestionView.vue') },
  { path: '/reading/shuffle', name: 'shuffle', component: () => import('../views/reading/ShuffleView.vue') },
  { path: '/reading/pick', name: 'pick', component: () => import('../views/reading/PickView.vue') },
  { path: '/reading/reveal', name: 'reveal', component: () => import('../views/reading/RevealView.vue') },
  {
    path: '/reading/interpretation',
    name: 'interpretation',
    component: () => import('../views/reading/InterpretationView.vue')
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

export function createAppRouter() {
  const router = createRouter({
    history: createWebHashHistory(),
    routes
  })

  router.beforeEach((to) => {
    // 首次启动强制引导（可从首页 ? 入口重看）
    if (!hasVisited() && to.path !== '/welcome') {
      return '/welcome'
    }

    if (to.path.startsWith('/reading')) {
      const store = useReadingStore()
      // question 携带 ?spread= / ?daily=1 是动线入口，由页面自行初始化
      if (to.name === 'question' && (to.query.spread || to.query.daily)) return true
      // 其余步骤须有进行中的占卜（含 sessionStorage 恢复），否则回首页
      if (!store.hasActiveReading()) return '/'
      // 步骤与阶段不符（如刷新后直接改 URL）→ 重定向到当前阶段对应步骤
      const expected = PHASE_ROUTE[store.phase]
      if (expected && to.path !== expected) return expected
    }
    return true
  })

  // 部署新版本后旧 hash chunk 被 SW 清掉：动态 import 失败时整页刷新，
  // 流程态在 sessionStorage（tarot.flow.v1），刷新后守卫按 phase 归位，几乎无损
  router.onError((err) => {
    if (/Failed to fetch dynamically imported|error loading dynamically imported/i.test(err?.message ?? '')) {
      location.reload()
    }
  })

  return router
}

export { VISITED_KEY, PHASE_ROUTE }
