<script setup>
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import TabBar from './components/TabBar.vue'
import AppToast from './components/AppToast.vue'

const route = useRoute()
// 占卜动线与引导页沉浸式展示，不显示 TabBar
const showTabBar = computed(() => !route.path.startsWith('/reading') && route.path !== '/welcome')
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
