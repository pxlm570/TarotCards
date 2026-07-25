<script setup>
// M3 交付：历史时间线、日记、Mirror 统计。此处为占位（空状态即引导原则）
</script>

<template>
  <div class="placeholder">
    <h1 class="title">记录</h1>
    <div class="empty">
      <span class="icon">📔</span>
      <p>占卜历史与日记将在这里沉淀</p>
      <p class="hint">敬请期待 · 里程碑 M3</p>
      <router-link to="/" class="action">完成你的第一次占卜</router-link>
    </div>
  </div>
</template>

<style scoped>
.placeholder {
  padding: 24px 20px;
}

.title {
  font-size: 1.375rem;
  margin-bottom: 48px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding-top: 15vh;
  color: var(--moon-dim);
}

.icon {
  font-size: 2.5rem;
}

.hint {
  font-size: 0.8125rem;
}

.action {
  margin-top: 16px;
  padding: 10px 24px;
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--gold-bright);
  text-decoration: none;
  font-size: 0.9375rem;
}
</style>
