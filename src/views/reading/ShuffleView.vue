<script setup>
// 洗牌页：两种模式可选（#8）——(a)互动拖洗+摇一摇 / (b)仪式翻洗动画。切换键持久化偏好。
// 数据抽牌仍由 crypto 真随机负责（store.finishShuffle），此处纯视觉仪式层。
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReadingStore } from '../../stores/reading.js'
import { safeGetItem, safeSetItem } from '../../lib/storage.js'
import { tap, success } from '../../lib/feedback.js'
import CardBack from '../../components/CardBack.vue'
import AppIcon from '../../components/AppIcon.vue'
import FlowExit from '../../components/FlowExit.vue'

const MODE_KEY = 'tarot.shuffle-mode.v1'
const HINT_KEY = 'tarot.shuffle-hint.v1'
const VISUAL_COUNT = 20

const router = useRouter()
const store = useReadingStore()

const mode = ref(safeGetItem(MODE_KEY) === 'riffle' ? 'riffle' : 'interactive')
const showHint = ref(!safeGetItem(HINT_KEY))
const cards = ref([])
let motionHandler = null
let permissionOnce = null
let lastShake = 0

// ---- 模式 (a)：互动拖洗 ----
function scatter() {
  cards.value = Array.from({ length: VISUAL_COUNT }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 70,
    y: (Math.random() - 0.5) * 46,
    r: (Math.random() - 0.5) * 50,
    delay: i * 38
  }))
}

function setupShake() {
  if (typeof DeviceMotionEvent === 'undefined') return
  if (typeof DeviceMotionEvent.requestPermission !== 'function') {
    listenShake()
  } else if (!showHint.value) {
    permissionOnce = () => {
      window.removeEventListener('pointerdown', permissionOnce)
      permissionOnce = null
      DeviceMotionEvent.requestPermission()
        .then((state) => state === 'granted' && listenShake())
        .catch(() => {})
    }
    window.addEventListener('pointerdown', permissionOnce)
  }
}

function dismissHint() {
  showHint.value = false
  safeSetItem(HINT_KEY, '1')
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission()
      .then((state) => {
        if (state === 'granted') listenShake()
      })
      .catch(() => {})
  } else if (typeof DeviceMotionEvent !== 'undefined' && !motionHandler) {
    listenShake()
  }
}

function listenShake() {
  if (motionHandler) return
  motionHandler = (e) => {
    const a = e.accelerationIncludingGravity
    if (!a) return
    const magnitude = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0)
    if (magnitude > 40 && Date.now() - lastShake > 800) {
      lastShake = Date.now()
      scatter()
      tap()
    }
  }
  window.addEventListener('devicemotion', motionHandler)
}

let dragging = false
function onPointerMove(e) {
  if (!dragging && e.buttons !== 1 && e.pointerType !== 'touch') return
  const rect = e.currentTarget.getBoundingClientRect()
  const px = ((e.clientX - rect.left) / rect.width - 0.5) * 100
  const py = ((e.clientY - rect.top) / rect.height - 0.5) * 100
  for (const c of cards.value) {
    const dx = c.x - px
    const dy = c.y - py
    const dist = Math.hypot(dx, dy)
    if (dist < 26) {
      c.x += (dx / (dist || 1)) * 8 + (Math.random() - 0.5) * 4
      c.y += (dy / (dist || 1)) * 6 + (Math.random() - 0.5) * 4
      c.r += (Math.random() - 0.5) * 18
      c.x = Math.max(-44, Math.min(44, c.x))
      c.y = Math.max(-30, Math.min(30, c.y))
    }
  }
}

// ---- 模式 (b)：仪式翻洗 ----
const rifflePhase = ref(0) // 0 未开始 / 1 洗牌中 / 2 完成
const riffleTimer = ref(null)

function startRiffle() {
  // 任何时候都可重洗（修复「再洗一次」失效）
  rifflePhase.value = 1
  clearTimeout(riffleTimer.value)
  riffleTimer.value = setTimeout(() => {
    rifflePhase.value = 2
    success()
  }, 2400)
}

function switchMode(m) {
  mode.value = m
  safeSetItem(MODE_KEY, m)
  if (m === 'riffle') {
    rifflePhase.value = 0
  } else {
    scatter()
  }
  tap()
}

function cut() {
  scatter()
  tap()
}

function done() {
  if (store.phase !== 'shuffling') return
  store.finishShuffle()
  router.replace(store.phase === 'revealing' ? '/reading/reveal' : '/reading/pick')
}

onMounted(() => {
  scatter()
  setupShake()
})

onUnmounted(() => {
  if (motionHandler) window.removeEventListener('devicemotion', motionHandler)
  if (permissionOnce) window.removeEventListener('pointerdown', permissionOnce)
  clearTimeout(riffleTimer.value)
})
</script>

<template>
  <div class="shuffle">
    <FlowExit confirm />
    <div class="mode-switch">
      <button class="mode" :class="{ on: mode === 'interactive' }" @click="switchMode('interactive')">互动拖洗</button>
      <button class="mode" :class="{ on: mode === 'riffle' }" @click="switchMode('riffle')">仪式翻洗</button>
    </div>

    <!-- 模式 a：互动拖洗 -->
    <template v-if="mode === 'interactive'">
      <p class="tip">拖动搅乱牌堆，或摇一摇手机</p>
      <div
        class="pool"
        @pointerdown="dragging = true"
        @pointerup="dragging = false"
        @pointercancel="dragging = false"
        @pointerleave="dragging = false"
        @pointermove="onPointerMove"
      >
        <div v-for="c in cards" :key="c.id" class="fly"
          :style="{ transform: `translate(${c.x}%, ${c.y}%) rotate(${c.r}deg)`, transitionDelay: c.delay + 'ms' }">
          <div class="bob" :style="{ animationDelay: (c.id % 8) * 0.45 + 's' }">
            <CardBack class="back" />
          </div>
        </div>
      </div>
      <div class="actions">
        <button class="btn-ghost" @click="cut">切牌</button>
        <button class="btn-solid" @click="done">洗好了</button>
      </div>
    </template>

    <!-- 模式 b：仪式翻洗 -->
    <template v-else>
      <p class="tip">{{ rifflePhase === 0 ? '点一下牌堆，开始翻洗' : rifflePhase === 1 ? '洗牌中…' : '洗好了' }}</p>
      <div class="riffle" @click="rifflePhase !== 1 && startRiffle()">
        <div class="riffle-stack" :class="{ washing: rifflePhase === 1, done: rifflePhase === 2 }">
          <div v-for="i in 12" :key="i" class="riffle-card"><CardBack class="back" /></div>
        </div>
      </div>
      <div class="actions">
        <button class="btn-ghost" :disabled="rifflePhase === 1" @click="startRiffle">{{ rifflePhase === 0 ? '开始翻洗' : '再洗一次' }}</button>
        <button class="btn-solid" :disabled="rifflePhase !== 2" @click="done">洗好了</button>
      </div>
    </template>

    <div v-if="showHint" class="hint" @click="dismissHint">
      <div class="hint-card card">
        <span class="hint-icon"><AppIcon name="drag" :size="34" /></span>
        <p class="hint-title">拖动我，或摇一摇</p>
        <p class="hint-sub">点击任意处开始</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shuffle {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 40px 20px calc(32px + env(safe-area-inset-bottom, 0px));
}

.mode-switch {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.mode {
  flex: 1;
  padding: 9px;
  border-radius: var(--radius-btn);
  background: var(--surface);
  border: 2px solid var(--line);
  border-bottom-width: 3px;
  color: var(--dim);
  font-size: var(--fs-note);
  font-weight: var(--w-strong);
  cursor: pointer;
}

.mode.on {
  border-color: var(--gold-deep);
  background: var(--gold-soft);
  color: var(--gold-text);
}

.tip {
  text-align: center;
  color: var(--dim);
  font-size: var(--fs-note);
  font-weight: var(--w-medium);
  letter-spacing: 0.2em;
  text-indent: 0.2em;
  margin-bottom: 8px;
}

.pool {
  flex: 1;
  position: relative;
  overflow: hidden;
  touch-action: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fly {
  position: absolute;
  width: 88px;
  transition: transform 0.9s var(--ease-out);
  pointer-events: none;
}

.bob {
  animation: bob 3.6s ease-in-out infinite;
}

@keyframes bob {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg) scale(1);
  }
  50% {
    transform: translateY(-10px) rotate(3deg) scale(1.04);
  }
}

/* 仪式翻洗：动态性更强的洗牌动画 */
.riffle {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 900px;
}

.riffle-stack {
  position: relative;
  width: 150px;
  height: 260px;
}

.riffle-card {
  position: absolute;
  inset: 0;
}

.riffle-card .back {
  width: 100%;
  height: 100%;
}

.riffle-stack.washing .riffle-card:nth-child(odd) {
  animation: riffle-a 0.28s ease-in-out infinite alternate;
}
.riffle-stack.washing .riffle-card:nth-child(even) {
  animation: riffle-b 0.2s ease-in-out infinite alternate;
}

@keyframes riffle-a {
  0% {
    transform: translateX(-16px) rotate(-10deg) translateY(0);
  }
  50% {
    transform: translateX(-2px) rotate(-2deg) translateY(-12px);
  }
  100% {
    transform: translateX(-16px) rotate(-10deg) translateY(2px);
  }
}

@keyframes riffle-b {
  0% {
    transform: translateX(16px) rotate(10deg) translateY(0);
  }
  50% {
    transform: translateX(2px) rotate(2deg) translateY(-12px);
  }
  100% {
    transform: translateX(16px) rotate(10deg) translateY(2px);
  }
}

/* 洗牌完成：整副牌聚拢 + 金色微光 */
.riffle-stack.done .riffle-card {
  animation: settle 0.4s var(--ease-out) both;
}

.riffle-stack.done {
  filter: drop-shadow(0 0 14px var(--gold-glow));
}

@keyframes settle {
  to {
    transform: translate(0, 0) rotate(0);
  }
}

.actions {
  display: flex;
  gap: 14px;
  margin-top: 10px;
}

.actions > button {
  flex: 1;
}

.hint {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.hint-card {
  padding: var(--sp-4) 40px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  box-shadow: var(--shadow-pop);
}

.hint-icon {
  align-self: center;
  color: var(--gold-text);
  animation: wave 1.4s ease-in-out infinite;
}

@keyframes wave {
  0%,
  100% {
    transform: translateX(-9px);
  }
  50% {
    transform: translateX(9px);
  }
}

.hint-title {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
}

.hint-sub {
  font-size: var(--fs-note);
  color: var(--dim);
}

@media (prefers-reduced-motion: reduce) {
  .fly {
    transition: none;
  }
  .hint-icon,
  .bob,
  .riffle-stack.washing .riffle-card,
  .riffle-stack.done .riffle-card {
    animation: none;
  }
}
</style>
