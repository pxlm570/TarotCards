<script setup>
// 方案一样张「星光牌阵」：牌背扇形弧排 + 星尘穹顶，中央牌即每日一抽入口。
// 静态演示（连胜 6），入场时扇形逐张展开；动效降级见样式尾部。
import { ref, computed, onMounted } from 'vue'
import AppIcon from '../AppIcon.vue'
import SampleBlocks from './SampleBlocks.vue'
import { useDeck } from '../../lib/use-deck.js'

defineProps({
  drawn: { type: Boolean, default: false },
  greeting: { type: String, default: '' }
})

const { backUrl, cardUrl } = useDeck()
// 已抽态演示牌面用「星辰」（major-17），呼应星语品牌
const faceUrl = computed(() => cardUrl('major-17'))

const SLOTS = [
  { r: -16, ty: 30 },
  { r: -8, ty: 10 },
  { r: 0, ty: 0 },
  { r: 8, ty: 10 },
  { r: 16, ty: 30 }
]

const on = ref(false)
onMounted(() => {
  setTimeout(() => {
    on.value = true
  }, 80)
})
</script>

<template>
  <div class="page fanp">
    <header class="head">
      <h1 class="brand">星语<em>塔罗</em></h1>
      <AppIcon name="help" :size="22" />
    </header>

    <section class="hero">
      <div class="stars" aria-hidden="true" />
      <div class="fan" :class="{ on }">
        <template v-for="(s, i) in SLOTS" :key="i">
          <button
            v-if="i === 2"
            type="button"
            class="fan-card center"
            :style="{ '--r': s.r + 'deg', '--ty': s.ty + 'px', '--i': i }"
            aria-label="每日一抽"
          >
            <img v-if="drawn ? faceUrl : backUrl()" :src="drawn ? faceUrl : backUrl()" alt="每日一抽" />
            <span v-else class="ph" />
            <span class="streak-badge"><b>6</b> 天</span>
          </button>
          <div v-else class="fan-card" :style="{ '--r': s.r + 'deg', '--ty': s.ty + 'px', '--i': i }" aria-hidden="true">
            <img v-if="backUrl()" :src="backUrl()" alt="" />
            <span v-else class="ph" />
          </div>
        </template>
      </div>
      <p class="hint">{{ drawn ? '今日已抽 · 星辰' : '点中央的牌，抽今日一抽' }}</p>
      <p class="greet">{{ greeting }}</p>
    </section>

    <SampleBlocks :drawn="drawn" :face-url="faceUrl" />
  </div>
</template>

<style scoped>
.fanp {
  padding: var(--sp-3) 20px 110px;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--dim);
}

.brand {
  font-family: var(--serif);
  font-size: 1.375rem;
  font-weight: var(--w-title);
  color: var(--ink);
}

.brand em {
  font-style: normal;
  color: var(--gold-text);
}

/* ---- 星尘穹顶 + 牌阵 ---- */
.hero {
  position: relative;
  margin: 0 -20px;
  padding: 30px 0 10px;
  overflow: hidden;
  background: radial-gradient(130% 100% at 50% 0%, var(--gold-soft) 0%, transparent 58%);
}

[data-theme="dark"] .hero {
  background: radial-gradient(130% 100% at 50% 0%, var(--surface) 0%, transparent 62%);
}

.stars {
  position: absolute;
  inset: 0;
  pointer-events: none;
  animation: twinkle 4s ease-in-out infinite alternate;
  background-image:
    radial-gradient(1.5px 1.5px at 18% 30%, var(--gold-text), transparent 60%),
    radial-gradient(1px 1px at 32% 18%, var(--dim), transparent 60%),
    radial-gradient(1.5px 1.5px at 55% 24%, var(--gold), transparent 60%),
    radial-gradient(1px 1px at 70% 14%, var(--dim), transparent 60%),
    radial-gradient(1.5px 1.5px at 82% 34%, var(--gold-text), transparent 60%),
    radial-gradient(1px 1px at 12% 55%, var(--dim), transparent 60%),
    radial-gradient(1px 1px at 90% 60%, var(--dim), transparent 60%),
    radial-gradient(1.5px 1.5px at 44% 10%, var(--gold), transparent 60%);
}

@keyframes twinkle {
  from { opacity: 0.55; }
  to { opacity: 0.95; }
}

.fan {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  height: 218px;
}

.fan-card {
  position: relative;
  width: 90px;
  aspect-ratio: 500 / 878;
  margin-left: -28px;
  border-radius: var(--radius-img);
  background: var(--sunk);
  box-shadow: var(--shadow-card);
  transform-origin: 50% 130%;
  transform: rotate(0deg) translateY(22px) scale(0.94);
  opacity: 0;
  transition:
    transform var(--t-slow) var(--ease-out) calc(var(--i) * 90ms),
    opacity var(--t-mid) ease calc(var(--i) * 90ms);
}

.fan .fan-card:first-child {
  margin-left: 0;
}

.fan.on .fan-card {
  opacity: 1;
  transform: rotate(var(--r)) translateY(var(--ty));
}

.fan-card img,
.ph {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
  display: block;
}

.fan-card.center {
  width: 114px;
  z-index: 2;
  padding: 0;
  border: 1px solid var(--gold-deep);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  box-shadow: 0 10px 24px var(--gold-glow), var(--shadow-card);
}

.fan.on .fan-card.center {
  animation: halo 3.2s ease-in-out infinite;
}

@keyframes halo {
  0%, 100% { box-shadow: 0 10px 24px var(--gold-glow), var(--shadow-card); }
  50% { box-shadow: 0 10px 28px var(--gold-glow), 0 0 0 6px var(--gold-soft), var(--shadow-card); }
}

.streak-badge {
  position: absolute;
  top: -10px;
  right: -8px;
  background: var(--gold);
  color: var(--on-gold);
  border-radius: var(--radius-pill);
  padding: 3px 9px;
  font-size: 0.6875rem;
  font-weight: var(--w-strong);
  box-shadow: var(--shadow-card);
  white-space: nowrap;
}

.streak-badge b {
  font-size: 0.875rem;
  line-height: 1;
}

.hint {
  text-align: center;
  margin-top: 16px;
  font-size: var(--fs-note);
  font-weight: var(--w-strong);
  color: var(--gold-text);
}

.greet {
  text-align: center;
  margin: 4px 0 var(--sp-3);
  font-size: var(--fs-body);
  color: var(--dim);
}

/* ---- 动效降级：系统偏好 + app 内设置 ---- */
@media (prefers-reduced-motion: reduce) {
  .fan-card { transition: none; }
  .fan.on .fan-card.center, .stars { animation: none; }
}

[data-motion="reduced"] .fan-card { transition: none; }
[data-motion="reduced"] .fan.on .fan-card.center { animation: none; }
[data-motion="reduced"] .stars { animation: none; }
</style>
