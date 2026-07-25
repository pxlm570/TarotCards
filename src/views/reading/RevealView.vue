<script setup>
// 翻牌页：点一张翻一张（600ms 3D 翻转，逆位旋转 180°）；「全部翻开」大牌阵刚需。
// 翻开状态直接来自 store.revealedKeys（乱序翻牌 + 刷新恢复都一致）。
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useReadingStore } from '../../stores/reading.js'
import SpreadCanvas from '../../components/SpreadCanvas.vue'

const router = useRouter()
const store = useReadingStore()

const revealed = computed(() => new Set(store.revealedKeys))
const allRevealed = computed(() => store.revealedCount === store.cardCount)
// 大牌阵用竖版画布 + 缩小牌宽，避免溢出与右列遮挡
const big = computed(() => store.cardCount > 5)

function flip(card) {
  if (store.phase !== 'revealing' || revealed.value.has(card.positionKey)) return
  store.revealCard(card.positionKey)
  if (navigator.vibrate) navigator.vibrate(10)
}

function flipAll() {
  if (store.phase !== 'revealing') return
  store.revealAll()
}

function interpret() {
  if (store.phase !== 'revealing' || !allRevealed.value) return
  store.goInterpret()
  router.replace('/reading/interpretation')
}
</script>

<template>
  <div class="reveal">
    <p class="tip">{{ allRevealed ? '牌面已全部揭晓' : '点击牌背，逐张翻开' }}</p>

    <div class="canvas-wrap">
      <SpreadCanvas
        v-if="store.spread"
        :spread="store.spread"
        :cards="store.drawn"
        :revealed="revealed"
        :portrait="big"
        :card-width-pct="big ? 14 : 18"
        @flip="flip"
      />
    </div>

    <div class="actions">
      <button v-if="!allRevealed" class="ghost" @click="flipAll">全部翻开</button>
      <button v-else class="primary" @click="interpret">查看解读</button>
    </div>
  </div>
</template>

<style scoped>
.reveal {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 48px 16px calc(32px + env(safe-area-inset-bottom, 0px));
}

.tip {
  text-align: center;
  color: var(--moon-dim);
  font-size: 0.875rem;
  letter-spacing: 0.1em;
  margin-bottom: 12px;
}

.canvas-wrap {
  flex: 1;
  display: flex;
  align-items: center;
}

.canvas-wrap > * {
  width: 100%;
}

.actions {
  position: relative;
  z-index: 3; /* 高于画布溢出的牌，保证按钮可点 */
  display: flex;
  justify-content: center;
}

.ghost,
.primary {
  min-width: 200px;
  padding: 14px 32px;
  border-radius: var(--radius-card);
  font-size: 1rem;
  font-family: var(--sans);
  cursor: pointer;
}

.ghost {
  background: none;
  border: 1px solid var(--gold);
  color: var(--gold-bright);
}

.primary {
  background: var(--gold);
  border: none;
  color: var(--on-gold);
  animation: glow 1.6s ease-in-out infinite;
}

@keyframes glow {
  0%,
  100% {
    box-shadow: 0 0 12px rgba(212, 175, 55, 0.25);
  }
  50% {
    box-shadow: 0 0 26px rgba(212, 175, 55, 0.5);
  }
}

@media (prefers-reduced-motion: reduce) {
  .primary {
    animation: none;
  }
}
</style>
