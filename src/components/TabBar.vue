<script setup>
const tabs = [
  { path: '/', icon: '🔮', label: '占卜' },
  { path: '/learn', icon: '🎓', label: '学习' },
  { path: '/deck', icon: '🃏', label: '牌库' },
  { path: '/journal', icon: '📔', label: '记录' },
  { path: '/profile', icon: '⚙️', label: '我的' }
]
</script>

<template>
  <nav class="tabbar">
    <router-link v-for="tab in tabs" :key="tab.path" :to="tab.path" class="tab" active-class="active">
      <span class="tab-icon">{{ tab.icon }}</span>
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
  background: var(--bg-inset);
  border-top: 1px solid rgba(184, 145, 47, 0.18);
  z-index: 10;
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  text-decoration: none;
  color: var(--moon-dim);
  font-size: 0.6875rem;
  transition: color 0.2s;
}

.tab.active {
  color: var(--gold-bright);
}

.tab-icon {
  font-size: 1.25rem;
  line-height: 1;
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
    border-right: 1px solid rgba(184, 145, 47, 0.18);
    background: transparent;
  }

  .tab {
    flex: none;
    padding: 14px 0;
    width: 100%;
  }
}
</style>
