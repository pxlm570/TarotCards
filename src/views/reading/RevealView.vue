<script setup>
// 翻牌页（Task 16 改版）：点牌背直接翻（600ms 3D + 金光斜扫），无二次确认弹窗。
// 键盘（桌面）：Enter = 全部翻开。
// 自由摆放局（v1.5 Task 7）：翻开的牌可拖动摆位；全部揭开后可把摆法存为我的牌阵。
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReadingStore } from '../../stores/reading.js'
import SpreadCanvas from '../../components/SpreadCanvas.vue'
import FlowExit from '../../components/FlowExit.vue'
import { saveCustomSpread } from '../../lib/custom-spreads.js'
import { tap, success, toast } from '../../lib/feedback.js'

const router = useRouter()
const store = useReadingStore()

const free = computed(() => store.freeMode)
const revealed = computed(() => new Set(store.revealedKeys))
const allRevealed = computed(() => store.revealedCount === store.cardCount)
// 大牌阵用竖版画布 + 缩小牌宽，避免溢出与右列遮挡
const big = computed(() => store.cardCount > 5)
// 牌越少牌越大：单张牌阵用 18% 会是一张小邮票孤零零躺在空画布中央
const cardPct = computed(() => (big.value ? 14 : store.cardCount === 1 ? 32 : 18))

function flip(card) {
  if (store.phase !== 'revealing' || revealed.value.has(card.positionKey)) return
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

function onMove(key, x, y) {
  store.moveFreePosition(key, x, y)
}

function interpret() {
  if (store.phase !== 'revealing' || !allRevealed.value) return
  store.goInterpret()
  router.replace('/reading/interpretation')
}

// ---- 存为我的牌阵（自由摆放闭环：摆法一键固化，可再去编辑器改名/牌位） ----
const savePanel = ref(false)
const saveName = ref('')
const saved = ref(false)

function openSavePanel() {
  saveName.value = ''
  savePanel.value = true
  tap()
}

function confirmSave() {
  try {
    const created = saveCustomSpread({ name: saveName.value, positions: store.freePositions })
    saved.value = true
    savePanel.value = false
    toast(`已存入「我的牌阵」：${created.name}`)
  } catch (err) {
    toast(String(err.message ?? err).replace('[custom-spread] ', ''), 'warn')
  }
}

// 桌面键盘（Task 12/20-D）：Enter = 全部翻开；但焦点在画布内 slot 按钮时放行原生 click（单翻）
function onKey(e) {
  if (e.key !== 'Enter' || allRevealed.value) return
  const el = document.activeElement
  if (el && el.closest && (el.closest('.canvas') || el.closest('.flow-exit'))) return
  e.preventDefault()
  flipAll()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="reveal">
    <FlowExit confirm :to="store.entryPath || '/'" />
    <p class="tip" :class="{ done: allRevealed }">
      <template v-if="free && !allRevealed">点击牌背翻开，翻开后可拖动摆位</template>
      <template v-else-if="free && allRevealed">拖动调整位置，摆好了去看解读</template>
      <template v-else>{{ allRevealed ? '牌面已全部揭晓' : '点击牌背，逐张翻开' }}</template>
    </p>

    <div class="canvas-wrap">
      <SpreadCanvas
        v-if="store.spread"
        :spread="store.spread"
        :cards="store.drawn"
        :revealed="revealed"
        :portrait="big"
        :card-width-pct="cardPct"
        :draggable="free"
        @flip="flip"
        @move="onMove"
      />
    </div>

    <div class="actions">
      <template v-if="!allRevealed">
        <button class="wide btn-ghost" @click="flipAll">全部翻开</button>
      </template>
      <template v-else>
        <button v-if="free && !saved" class="wide btn-ghost" @click="openSavePanel">存为我的牌阵</button>
        <button class="wide primary btn-solid" @click="interpret">查看解读</button>
      </template>
    </div>

    <!-- 摆法命名保存：轻量底部面板，不引入正式弹层 -->
    <div v-if="savePanel" class="save-mask" @click.self="savePanel = false">
      <div class="save-panel card">
        <p class="save-title">给这套摆法起个名字</p>
        <input
          v-model="saveName"
          class="save-input"
          type="text"
          maxlength="12"
          placeholder="比如：三张速览"
          @keydown.enter="confirmSave"
        />
        <div class="save-ops">
          <button class="btn-ghost" @click="savePanel = false">取消</button>
          <button class="btn-solid" :disabled="!saveName.trim()" @click="confirmSave">保存</button>
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

/* 全部翻开后的下一步引导：金辉脉冲（仪式链定稿 ⑤） */
.primary {
  animation: glowpulse 1.8s ease-in-out infinite;
}

.save-mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(6, 10, 22, 0.45);
}

.save-panel {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 18px calc(20px + env(safe-area-inset-bottom, 0px));
  border-radius: var(--radius) var(--radius) 0 0;
}

.save-title {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
}

.save-input {
  width: 100%;
  padding: 10px 12px;
  font-size: 16px; /* iOS 聚焦不自动放大 */
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}

.save-input:focus {
  outline: none;
  border-color: var(--gold);
}

.save-ops {
  display: flex;
  gap: 10px;
}

.save-ops button {
  flex: 1;
  padding: 12px;
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
