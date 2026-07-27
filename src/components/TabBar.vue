<script setup>
import AppIcon from './AppIcon.vue'

const tabs = [
  { path: '/', icon: 'reading', label: '占卜' },
  { path: '/learn', icon: 'learn', label: '学习' },
  { path: '/deck', icon: 'deck', label: '牌库' },
  { path: '/journal', icon: 'journal', label: '记录' },
  { path: '/profile', icon: 'profile', label: '我的' }
]
</script>

<template>
  <nav class="tabbar">
    <router-link v-for="tab in tabs" :key="tab.path" :to="tab.path" class="tab" active-class="active">
      <AppIcon :name="tab.icon" :size="23" />
      <span class="tab-label">{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  display: flex;
  background: var(--surface);
  border-top: 2px solid var(--line); /* 扁平分层：靠描边不靠投影 */
  z-index: 10;
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  text-decoration: none;
  color: var(--dim);
  font-size: 0.6875rem;
  font-weight: var(--w-strong);
  -webkit-tap-highlight-color: transparent;
  transition: color var(--t-fast), transform var(--t-press) var(--ease-out);
}

/* 当前项——金色纪律允许的三种用途之一 */
.tab.active {
  color: var(--gold-text);
}

.tab:active {
  transform: scale(0.92);
}


/* 桌面宽屏：左侧竖栏 */
@media (min-width: 1024px) {
  .tabbar {
    top: 0;
    bottom: auto;
    left: calc(50% - 240px - 100px);
    right: auto;
    width: 88px;
    height: 100vh;
    height: 100dvh;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    border-top: none;
    border-right: 2px solid var(--line);
    background: var(--bg);
  }

  .tab {
    flex: none;
    padding: 14px 0;
    width: 100%;
  }
}
</style>
