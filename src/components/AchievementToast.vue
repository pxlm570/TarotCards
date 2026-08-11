<script setup>
// 成就弹出（M2 Task 6）：轮询 justUnlocked 队列，逐条展示成就横幅。
// 独立于轻提示 toast，成就有专属的庆祝观感。
import { ref, onMounted, onUnmounted } from 'vue'
import { useAchievementsStore } from '../stores/achievements.js'
import AppIcon from './AppIcon.vue'

const achievements = useAchievementsStore()
const current = ref(null)
let timer = null
let hideTimer = null

function pump() {
  if (current.value) return // 正在展示
  const next = achievements._pop()
  if (next) {
    current.value = next
    hideTimer = setTimeout(() => {
      current.value = null
    }, 2600)
  }
}

onMounted(() => {
  timer = setInterval(pump, 300)
  pump()
})
onUnmounted(() => {
  clearInterval(timer)
  clearTimeout(hideTimer)
})
</script>

<template>
  <Transition name="ach">
    <div v-if="current" class="ach">
      <span class="ach-icon"><AppIcon name="star" :size="20" /></span>
      <div class="ach-main">
        <p class="ach-title">成就解锁 · {{ current.title }}</p>
        <p class="ach-desc">{{ current.desc }}</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.ach {
  position: fixed;
  top: calc(12px + env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 70;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(88vw, 400px);
  padding: 12px 18px;
  border-radius: var(--radius-card);
  background: var(--surface);
  border: 2px solid var(--gold-deep);
  color: var(--ink);
  box-shadow: var(--shadow-pop);
}

.ach-icon {
  color: var(--gold-text);
  animation: twinkle 1.2s ease-in-out infinite;
}

.ach-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ach-title {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  color: var(--gold-text);
}

.ach-desc {
  font-size: var(--fs-note);
  color: var(--dim);
}

@keyframes twinkle {
  0%,
  100% {
    transform: scale(0.9);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}

.ach-enter-active {
  transition: opacity var(--t-fast) var(--ease-out), transform var(--t-fast) var(--ease-pop);
}

.ach-leave-active {
  transition: opacity var(--t-fast) var(--ease-out), transform var(--t-fast) var(--ease-out);
}

.ach-enter-from,
.ach-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-14px) scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .ach-icon {
    animation: none;
  }
}
</style>
