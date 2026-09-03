<script setup>
// 牌阵画布：位置按 spreads.json 的 x/y 百分比绝对定位，牌宽取容器宽度百分比。
// portrait（3:4 竖版）供大牌阵（凯尔特十字）使用，避免纵向溢出与右列互相遮挡。
// cards: store.drawn；revealed: Set<positionKey>，null = 全部翻开（readonly 场景）。
// draggable（v1.5 自由摆放）：已翻开的牌可拖动，实时 emit move(key, x%, y%)。
import { computed, ref } from 'vue'
import { useDeck } from '../lib/use-deck.js'

const props = defineProps({
  spread: { type: Object, required: true },
  cards: { type: Array, required: true },
  revealed: { type: Object, default: null }, // Set；null = 全部翻开
  readonly: { type: Boolean, default: false },
  cardWidthPct: { type: Number, default: 18 },
  portrait: { type: Boolean, default: false },
  draggable: { type: Boolean, default: false }
})

const emit = defineEmits(['flip', 'inspect', 'move'])

const { manifest, cardUrl, backUrl, error, retry } = useDeck()

// 悬空 positionKey 兜底（评审 2026-09-03）：牌阵编辑删位后，历史记录的 key 可能对不上，
// 画布跳过该牌渲染而不是对 undefined 取坐标崩页（文字列表在详情页仍有「第 N 张」兜底）
const placed = computed(() =>
  props.cards.flatMap((c) => {
    const position = props.spread.positions?.find((p) => p.key === c.positionKey)
    return position ? [{ ...c, position }] : []
  })
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

// ---- 拖动摆位（draggable 且已翻开的牌）----
// 点按与拖动共用 pointerdown：位移超过约 1% 画布宽才算拖，避免手抖点按挪动牌
const canvasEl = ref(null)
let dragKey = null
let dragStart = null

function canvasPoint(e) {
  const rect = canvasEl.value.getBoundingClientRect()
  return { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 }
}

function onDragDown(card, e) {
  if (!props.draggable || !isRevealed(card.positionKey)) return
  dragKey = card.positionKey
  dragStart = canvasPoint(e)
  e.currentTarget.setPointerCapture?.(e.pointerId)
}

function onDragMove(e) {
  if (!dragKey) return
  const pt = canvasPoint(e)
  if (dragStart && Math.hypot(pt.x - dragStart.x, pt.y - dragStart.y) < 1) return
  dragStart = null // 已过阈值，后续移动实时生效
  emit('move', dragKey, pt.x, pt.y)
}

function onDragEnd() {
  dragKey = null
  dragStart = null
}
</script>

<template>
  <div ref="canvasEl" class="canvas" :class="{ portrait, readonly, draggable }">
    <button
      v-for="card in placed"
      :key="card.positionKey"
      class="slot"
      :class="{ movable: draggable && isRevealed(card.positionKey) }"
      :style="{
        left: card.position.x + '%',
        top: card.position.y + '%',
        width: cardWidthPct + '%',
        zIndex: card.position.rotate ? 2 : 1
      }"
      @click="onTap(card)"
      @pointerdown="onDragDown(card, $event)"
      @pointermove="onDragMove"
      @pointerup="onDragEnd"
      @pointercancel="onDragEnd"
    >
      <div
        class="flipper"
        :class="{ flipped: isRevealed(card.positionKey) }"
        :style="card.position.rotate ? { transform: `rotate(${card.position.rotate}deg)` } : undefined"
      >
        <div class="inner">
          <!-- 皮肤未就位时是骨架占位，不是空白渐变（等待也要有反馈） -->
          <div class="face back" :class="{ skeleton: !manifest }">
            <img v-if="manifest && backUrl()" :src="backUrl()" alt="牌背" draggable="false" />
          </div>
          <div class="face front" :class="{ reversed: card.reversed, skeleton: !manifest }">
            <img v-if="manifest && cardUrl(card.cardId)" :src="cardUrl(card.cardId)" :alt="card.cardId" draggable="false" />
          </div>
        </div>
      </div>
      <!-- 旋转牌（横压位）的标签移到牌上方，避免与同坐标竖牌的标签重叠 -->
      <span
        v-if="!readonly"
        class="pos-label"
        :class="{ top: card.position.rotate, 'flipped-label': isRevealed(card.positionKey) }"
      >
        {{ card.position.label }}
      </span>
    </button>

    <div v-if="error && !manifest" class="load-error">
      <button class="retry btn-ghost" @click="retry">牌面加载失败，点此重试</button>
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

/* 自由摆放：拖牌不触发页面滚动；已翻开的牌提示可拖 */
.canvas.draggable .slot {
  touch-action: none;
}

.canvas.draggable .slot.movable {
  cursor: grab;
}

.canvas.draggable .slot.movable:active {
  cursor: grabbing;
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
  border-radius: var(--radius-img);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  background: var(--sunk); /* 图未到位时是牌形占位，不是空洞 */
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

/* 翻牌落定后的「金光斜扫」——揭示的荣誉时刻（仪式链定稿 ⑤，全站庆祝动效原型）。
   解读页（readonly，进场即全开）不放，否则每次渲染都闪一遍。 */
.face.front::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 30%, rgba(255, 224, 120, 0.55) 50%, transparent 70%);
  transform: translateX(-130%);
}

.canvas:not(.readonly) .flipper.flipped .face.front::after {
  animation: shine 0.7s 0.5s both;
}

@keyframes shine {
  to {
    transform: translateX(130%);
  }
}

.pos-label {
  /* 标签放在牌上方，避免被下方相邻牌盖住 */
  order: -1;
  font-size: 0.6875rem;
  font-weight: var(--w-medium);
  color: var(--dim);
  white-space: nowrap;
  text-shadow: 0 1px 3px var(--bg);
}

/* 已翻开 = 当前有效项，用金色标出 */
.flipped-label {
  color: var(--gold-text);
  font-weight: var(--w-strong);
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
  font-size: var(--fs-note);
  padding: 12px 18px;
}

@media (prefers-reduced-motion: reduce) {
  .inner {
    transition: none;
  }
  .canvas:not(.readonly) .flipper.flipped .face.front::after {
    animation: none;
  }
}
</style>
