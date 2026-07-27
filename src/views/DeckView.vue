<script setup>
// M2 交付：78 牌网格/搜索/详情、皮肤切换。此处为占位（空状态即引导原则）
import AppIcon from '../components/AppIcon.vue'
</script>

<template>
  <div class="placeholder">
    <h1 class="title">牌库</h1>
    <div class="empty">
      <span class="icon"><AppIcon name="deck" :size="34" /></span>
      <p class="empty-title">78 张牌的百科全书正在编纂</p>
      <p class="hint">敬请期待 · 里程碑 M2</p>
      <router-link to="/" class="action btn-solid">先去抽一张牌</router-link>
    </div>
  </div>
</template>

<style scoped>
/* 空状态即引导：图标 + 一句说明 + 明确的下一步行动（不做死页面） */
.placeholder {
  padding: var(--sp-3) 20px;
}

.title {
  font-size: var(--fs-title);
  margin-bottom: var(--sp-4);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding-top: 12vh;
  color: var(--dim);
}

.icon {
  width: 84px;
  height: 84px;
  margin-bottom: 6px;
  border-radius: 50%;
  background: var(--sunk);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.25rem;
  color: var(--dim);
}

.empty-title {
  font-size: var(--fs-head);
  font-weight: var(--w-strong);
  color: var(--ink);
}

.hint {
  font-size: var(--fs-note);
}

.action {
  margin-top: var(--sp-2);
  text-decoration: none;
}
</style>
