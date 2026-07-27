<script setup>
// 轻提示层（M1.5 Task 4.5）：两档 info / success，队列在 lib/feedback.js。
// 全层 pointer-events: none —— 提示永远不挡操作，也不打断动线。
import { toasts } from '../lib/feedback.js'
import AppIcon from './AppIcon.vue'
</script>

<template>
  <div class="toast-layer" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">
        <AppIcon :name="t.type === 'success' ? 'check' : 'star'" :size="16" />
        <span>{{ t.text }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-layer {
  position: fixed;
  top: calc(12px + env(safe-area-inset-top, 0px));
  left: 0;
  right: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-1);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(88vw, 420px);
  padding: 11px 18px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  border: 2px solid var(--line);
  color: var(--ink);
  font-size: var(--fs-note);
  font-weight: var(--w-strong);
  box-shadow: var(--shadow-pop);
}

/* 浮层必须完全不透明：暗夜主题 --gold-soft 是半透明金，
   直接当底会透出下面的正文，所以垫一层 surface 再叠金 */
.toast.success {
  border-color: var(--gold-deep);
  background-color: var(--surface);
  background-image: linear-gradient(var(--gold-soft), var(--gold-soft));
  color: var(--gold-text);
}

.toast-enter-active {
  transition: opacity var(--t-fast) var(--ease-out), transform var(--t-fast) var(--ease-pop);
}

.toast-leave-active {
  transition: opacity var(--t-fast) var(--ease-out), transform var(--t-fast) var(--ease-out);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-14px) scale(0.96);
}
</style>
