<script setup>
import { useRoute, useRouter } from 'vue-router'
import { computed, onMounted, onUnmounted } from 'vue'
import TabBar from './components/TabBar.vue'
import AppToast from './components/AppToast.vue'
import AchievementToast from './components/AchievementToast.vue'
import AppInstallBanner from './components/AppInstallBanner.vue'
import LevelUpToast from './components/LevelUpToast.vue'
import { useReadingStore } from './stores/reading.js'
import { PHASE_ROUTE } from './router/index.js'

const route = useRoute()
const router = useRouter()
// 占卜动线、引导页、选牌阵页沉浸式展示，不显示 TabBar
const IMMERSIVE = ['/welcome', '/spreads']
const showTabBar = computed(() => !route.path.startsWith('/reading') && !IMMERSIVE.includes(route.path))

// 记录每次导航的来源页。popstate 触发时 vue-router 的导航已经落地（两个 popstate 监听之间
// 会排空微任务），route.path 读到的是「返回后的目标页」，判断不了「按返回前在哪」——
// 而 afterEach 的 from 正是这一次返回所离开的那一页。
let leftFrom = ''
router.afterEach((to, from) => {
  leftFrom = from.path
})

// UX #8 / Task 15：返回手势统一——占卜动线内返回键逐级回退，不误退。
// 回退落点经路由器导航（router.replace），保证 URL 与渲染组件始终一致（不能只改地址栏）。
function onBack() {
  // 只在动线内接管：动线外（首页/选牌阵/学习…）带着进行中的一局按返回，是普通的页面返回，
  // 不该把那一局倒退一步、更不该把人拽回占卜步骤。
  if (!leftFrom.startsWith('/reading')) return
  const store = useReadingStore()
  if (store.phase === 'idle') return // 非占卜中，交给浏览器默认
  const prev = store.stepBack()
  if (prev && PHASE_ROUTE[prev]) {
    router.replace(PHASE_ROUTE[prev])
  }
  // prev === null → 已退出本局，允许浏览器回退到首页
}

onMounted(() => window.addEventListener('popstate', onBack))
onUnmounted(() => window.removeEventListener('popstate', onBack))
</script>

<template>
  <div class="app-shell">
    <main class="app-content" :class="{ 'with-tabbar': showTabBar }">
      <!-- out-in：两屏永不同时存在，避免转场期出现重复内容 -->
      <router-view v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </router-view>
    </main>
    <TabBar v-if="showTabBar" />
    <AppToast />
    <AchievementToast />
    <LevelUpToast />
    <AppInstallBanner v-if="showTabBar" />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  min-height: 100dvh; /* 移动端动态地址栏；旧浏览器回退上一行 */
  background: var(--bg);
}

.app-content {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  min-height: 100dvh;
}

.app-content.with-tabbar {
  padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px));
}

/* 桌面宽屏：TabBar 变左侧竖栏，内容区右移让位 */
@media (min-width: 1024px) {
  .app-content.with-tabbar {
    padding-bottom: 0;
  }
}
</style>
