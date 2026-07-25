<script setup>
// 动线入口：/reading/breathe?spread=<id>。3s 呼吸引导，可跳过。
import { onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import spreads from '../../data/spreads.json'
import { useReadingStore } from '../../stores/reading.js'

const route = useRoute()
const router = useRouter()
const store = useReadingStore()

let timer = null

onMounted(() => {
  const spreadId = route.query.spread
  if (spreadId) {
    if (!spreads.some((s) => s.id === spreadId)) {
      router.replace('/')
      return
    }
    // 携带 spread 参数 = 开新局（重看/恢复场景不带参数，由守卫按 phase 分流）
    if (store.phase !== 'breathing' || store.spreadId !== spreadId) {
      store.reset()
      store.selectSpread(spreadId)
      store.beginBreathing()
    }
  } else if (store.phase !== 'breathing') {
    router.replace('/')
    return
  }
  timer = setTimeout(proceed, 3400)
})

onUnmounted(() => clearTimeout(timer))

function proceed() {
  clearTimeout(timer)
  if (store.phase === 'breathing') {
    store.toQuestion()
    router.replace('/reading/question')
  }
}
</script>

<template>
  <div class="breathe" @click="proceed">
    <div class="ring" />
    <p class="text">深呼吸，默念你的问题</p>
    <button class="skip" @click.stop="proceed">跳过</button>
  </div>
</template>

<style scoped>
.breathe {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 40px;
  position: relative;
}

.ring {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  border: 2px solid var(--gold);
  box-shadow: 0 0 40px rgba(184, 145, 47, 0.25), inset 0 0 24px rgba(184, 145, 47, 0.15);
  animation: breathe 3s ease-in-out infinite;
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
  }
}

.text {
  color: var(--moon-dim);
  letter-spacing: 0.15em;
}

.skip {
  position: absolute;
  right: 24px;
  bottom: calc(32px + env(safe-area-inset-bottom, 0px));
  background: none;
  border: none;
  color: var(--moon-dim);
  font-size: 0.875rem;
  cursor: pointer;
  padding: 14px 16px; /* 触控目标 ≥44px */
}

@media (prefers-reduced-motion: reduce) {
  .ring {
    animation: none;
  }
}
</style>
