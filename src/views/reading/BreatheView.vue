<script setup>
// 动线入口：/reading/breathe?spread=<id>。3s 呼吸引导，可跳过。
import { onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import spreads from '../../data/spreads.json'
import { useReadingStore } from '../../stores/reading.js'
import AppIcon from '../../components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const store = useReadingStore()

let timer = null

onMounted(() => {
  const isDaily = route.query.daily === '1'
  const spreadId = isDaily ? 'single' : route.query.spread
  if (isDaily || spreadId) {
    const sid = spreadId || 'single'
    if (!spreads.some((s) => s.id === sid)) {
      router.replace('/')
      return
    }
    // 携带 spread / daily 参数 = 开新局（重看/恢复场景不带参数，由守卫按 phase 分流）
    if (store.phase !== 'breathing' || store.spreadId !== sid || store.isDaily !== isDaily) {
      store.reset()
      store.isDaily = isDaily
      store.selectSpread(sid)
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
    <div class="ring-wrap">
      <div class="ring" />
      <div class="ring echo" />
      <div class="ring-star"><AppIcon name="star" :size="26" /></div>
    </div>
    <div class="words">
      <p class="text">深呼吸，默念你的问题</p>
      <p class="sub">吸气 · 呼气 · 慢慢来</p>
    </div>
    <button class="skip btn-text" @click.stop="proceed">跳过</button>
  </div>
</template>

<style scoped>
/* 仪式链 ① 静心（视觉基准：docs/style-demos/ritual-demo.html）
   双环错拍 + 中心星芒随呼吸明灭 + 文案透明度呼吸。
   一个呼吸周期 3.4s = 本页自动前进的 3400ms，用户正好看完整一次吸吐。 */
.breathe {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-4);
  position: relative;
  text-align: center;
}

.ring-wrap {
  position: relative;
  width: 168px;
  height: 168px;
}

.ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--gold);
  box-shadow: 0 0 34px var(--gold-glow), inset 0 0 22px var(--gold-glow);
  animation: breathe 3.4s ease-in-out infinite;
}

/* 回声环：延迟 0.35s 的错拍，让呼吸「活」起来 */
.ring.echo {
  animation-delay: 0.35s;
  opacity: 0.35;
  border-width: 1px;
  box-shadow: none;
}

.ring-star {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  color: var(--gold);
  animation: twinkle 3.4s ease-in-out infinite;
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

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(0.92);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}

.words {
  animation: textfade 3.4s ease-in-out infinite;
}

@keyframes textfade {
  0%,
  100% {
    opacity: 0.62;
  }
  50% {
    opacity: 1;
  }
}

.text {
  color: var(--dim);
  font-size: var(--fs-body);
  font-weight: var(--w-medium);
  letter-spacing: 0.3em;
  text-indent: 0.3em; /* 抵消末字后的字距，视觉居中 */
}

.sub {
  margin-top: 10px;
  font-size: var(--fs-note);
  color: var(--dim);
  opacity: 0.6;
}

.skip {
  position: absolute;
  right: 18px;
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
}

@media (prefers-reduced-motion: reduce) {
  .ring,
  .ring-star,
  .words {
    animation: none;
  }
}
</style>
