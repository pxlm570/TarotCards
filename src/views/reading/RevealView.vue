<script setup>
// 翻牌页：点一张翻一张（600ms 3D 翻转，逆位旋转 180°）；「全部翻开」大牌阵刚需。
// 翻开状态直接来自 store.revealedKeys（乱序翻牌 + 刷新恢复都一致）。
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useReadingStore } from '../../stores/reading.js'
import SpreadCanvas from '../../components/SpreadCanvas.vue'
import AppIcon from '../../components/AppIcon.vue'
import { tap, success } from '../../lib/feedback.js'

const router = useRouter()
const store = useReadingStore()

const revealed = computed(() => new Set(store.revealedKeys))
const allRevealed = computed(() => store.revealedCount === store.cardCount)
// 大牌阵用竖版画布 + 缩小牌宽，避免溢出与右列遮挡
const big = computed(() => store.cardCount > 5)
// 牌越少牌越大：单张牌阵用 18% 会是一张小邮票孤零零躺在空画布中央
const cardPct = computed(() => (big.value ? 14 : store.cardCount === 1 ? 32 : 18))

// 逐张翻牌防误触：先弹确认
const confirmCard = ref(null)
const confirmLabel = computed(() => {
  const pos = store.spread?.positions.find((p) => p.key === confirmCard.value?.positionKey)
  return pos?.label ?? ''
})

function flip(card) {
  if (store.phase !== 'revealing' || revealed.value.has(card.positionKey)) return
  confirmCard.value = card
}

function confirmFlip() {
  const card = confirmCard.value
  confirmCard.value = null
  if (!card) return
  store.revealCard(card.positionKey)
  // 最后一张翻开 = 完成时刻
  if (store.revealedCount === store.cardCount) success()
  else tap()
}

function flipAll() {
  if (store.phase !== 'revealing') return
  store.revealAll()
  success()
}

function interpret() {
  if (store.phase !== 'revealing' || !allRevealed.value) return
  store.goInterpret()
  router.replace('/reading/interpretation')
}
</script>

<template>
  <div class="reveal">
    <p class="tip" :class="{ done: allRevealed }">
      {{ allRevealed ? '牌面已全部揭晓' : '点击牌背，逐张翻开' }}
    </p>

    <div class="canvas-wrap">
      <SpreadCanvas
        v-if="store.spread"
        :spread="store.spread"
        :cards="store.drawn"
        :revealed="revealed"
        :portrait="big"
        :card-width-pct="cardPct"
        @flip="flip"
      />
    </div>

    <div class="actions">
      <button v-if="!allRevealed" class="wide btn-ghost" @click="flipAll">全部翻开</button>
      <button v-else class="wide primary btn-solid" @click="interpret">查看解读</button>
    </div>

    <!-- 逐张翻牌确认（防误触） -->
    <div v-if="confirmCard" class="modal" @click.self="confirmCard = null">
      <div class="dialog card">
        <p class="dialog-title">翻开这张？</p>
        <p class="dialog-sub">位置「{{ confirmLabel }}」</p>
        <div class="dialog-actions">
          <button class="btn-ghost" @click="confirmCard = null">取消</button>
          <button class="btn-solid" @click="confirmFlip"><AppIcon name="check" :size="15" /> 翻开</button>
        </div>
      </div>
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
  color: var(--dim);
  font-size: var(--fs-note);
  font-weight: var(--w-medium);
  letter-spacing: 0.2em;
  text-indent: 0.2em;
  margin-bottom: 12px;
  transition: color var(--t-fast);
}

/* 全部揭晓：文案转金并轻弹一下 */
.tip.done {
  color: var(--gold-text);
  font-weight: var(--w-strong);
  animation: pop var(--t-mid) var(--ease-pop) both;
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

.wide {
  min-width: 200px;
  padding: 14px 32px;
}

/* 翻牌确认弹层 */
.modal {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
  padding: 24px;
}

.dialog {
  width: 100%;
  max-width: 340px;
  padding: var(--sp-3);
  text-align: center;
}

.dialog-title {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  margin-bottom: 8px;
}

.dialog-sub {
  font-size: var(--fs-note);
  color: var(--dim);
  margin-bottom: 16px;
}

.dialog-actions {
  display: flex;
  gap: 10px;
}

.dialog-actions > button {
  flex: 1;
}

/* 全部翻开后的下一步引导：金辉脉冲（仪式链定稿 ⑤） */
.primary {
  animation: glowpulse 1.8s ease-in-out infinite;
}

@keyframes glowpulse {
  0%,
  100% {
    box-shadow: 0 0 10px var(--gold-glow);
  }
  50% {
    box-shadow: 0 0 24px var(--gold-glow);
  }
}

@media (prefers-reduced-motion: reduce) {
  .primary,
  .tip.done {
    animation: none;
  }
}
</style>
