<script setup>
// 牌阵画布：位置按 spreads.json 的 x/y 百分比绝对定位，牌宽取容器宽度百分比。
// portrait（3:4 竖版）供大牌阵（凯尔特十字）使用，避免纵向溢出与右列互相遮挡。
// cards: store.drawn；revealed: Set<positionKey>，null = 全部翻开（readonly 场景）。
import { computed } from 'vue'
import { useDeck } from '../lib/use-deck.js'

const props = defineProps({
  spread: { type: Object, required: true },
  cards: { type: Array, required: true },
  revealed: { type: Object, default: null }, // Set；null = 全部翻开
  readonly: { type: Boolean, default: false },
  cardWidthPct: { type: Number, default: 18 },
  portrait: { type: Boolean, default: false }
})

const emit = defineEmits(['flip', 'inspect'])

const { manifest, cardUrl, backUrl, error, retry } = useDeck()

const placed = computed(() =>
  props.cards.map((c) => ({
    ...c,
    position: props.spread.positions.find((p) => p.key === c.positionKey)
  }))
)

function isRevealed(key) {
  return props.revealed === null ? true : props.revealed.has(key)
}

// 同坐标堆叠（凯尔特十字 heart/cross）：上层按钮的命中矩形完全盖住下层，
// 因此点击按「堆叠感知」分发——翻牌时优先翻堆里未翻开的那张（先核心后阻碍，
// 恰是经典翻法）；readonly（解读页缩略导航）时在堆叠成员间轮换。
let inspectCycle = 0

function stackAt(card) {
  return placed.value.filter(
    (c) => c.position.x === card.position.x && c.position.y === card.position.y
  )
}

function onTap(card) {
  const stack = stackAt(card)
  if (!props.readonly) {
    const target = stack.find((c) => !isRevealed(c.positionKey))
    if (target) {
      emit('flip', target)
      return
    }
  }
  emit('inspect', stack[inspectCycle++ % stack.length])
}
</script>

<template>
  <div class="canvas" :class="{ portrait }">
    <button
      v-for="card in placed"
      :key="card.positionKey"
      class="slot"
      :style="{
        left: card.position.x + '%',
        top: card.position.y + '%',
        width: cardWidthPct + '%',
        zIndex: card.position.rotate ? 2 : 1
      }"
      @click="onTap(card)"
    >
      <div
        class="flipper"
        :class="{ flipped: isRevealed(card.positionKey) }"
        :style="card.position.rotate ? { transform: `rotate(${card.position.rotate}deg)` } : undefined"
      >
        <div class="inner">
          <div class="face back">
            <img v-if="manifest" :src="backUrl()" alt="牌背" draggable="false" />
          </div>
          <div class="face front" :class="{ reversed: card.reversed }">
            <img v-if="manifest && cardUrl(card.cardId)" :src="cardUrl(card.cardId)" :alt="card.cardId" draggable="false" />
          </div>
        </div>
      </div>
      <!-- 旋转牌（横压位）的标签移到牌上方，避免与同坐标竖牌的标签重叠 -->
      <span v-if="!readonly" class="pos-label" :class="{ top: card.position.rotate }">
        {{ card.position.label }}
      </span>
    </button>

    <div v-if="error && !manifest" class="load-error">
      <button class="retry" @click="retry">牌面加载失败，点此重试</button>
    </div>
  </div>
</template>

<style scoped>
.canvas {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
}

.canvas.portrait {
  aspect-ratio: 3 / 4;
}

.slot {
  position: absolute;
  transform: translate(-50%, -50%);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.flipper {
  width: 100%;
  perspective: 800px;
}

.inner {
  position: relative;
  width: 100%;
  aspect-ratio: 300 / 527;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.2, 0.7, 0.3, 1);
}

.flipper.flipped .inner {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
}

.face img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.face.front {
  transform: rotateY(180deg);
}

.face.front.reversed img {
  transform: rotate(180deg);
}

.pos-label {
  font-size: 0.6875rem;
  color: var(--moon-dim);
  white-space: nowrap;
}

.pos-label.top {
  order: -1;
}

.load-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.retry {
  padding: 12px 20px;
  border-radius: var(--radius-card);
  border: 1px solid var(--gold);
  background: var(--bg-inset);
  color: var(--gold-bright);
  font-family: var(--sans);
  font-size: 0.875rem;
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .inner {
    transition: none;
  }
}
</style>
