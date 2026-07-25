<script setup>
// 洗牌页：纯视觉仪式层（数据抽牌由 crypto 真随机负责，见 store.finishShuffle）。
// 约 20 张视觉牌背交错飞散；拖动搅乱、切牌重排、摇一摇（iOS 权限挂在引导浮层点击里）。
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReadingStore } from '../../stores/reading.js'
import { safeGetItem, safeSetItem } from '../../lib/storage.js'
import CardBack from '../../components/CardBack.vue'

const HINT_KEY = 'tarot.shuffle-hint.v1'
const VISUAL_COUNT = 20

const router = useRouter()
const store = useReadingStore()

const showHint = ref(!safeGetItem(HINT_KEY))
const cards = ref([])
let motionHandler = null
let permissionOnce = null
let lastShake = 0

function scatter() {
  cards.value = Array.from({ length: VISUAL_COUNT }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 70,
    y: (Math.random() - 0.5) * 46,
    r: (Math.random() - 0.5) * 50,
    delay: i * 38
  }))
}

onMounted(() => {
  scatter()
  // 摇一摇每局都要生效（不能只在首次引导浮层里注册）：
  // 无 requestPermission API（安卓/桌面）直接监听；iOS 且无浮层时，
  // 把权限请求挂在本页第一个触摸手势上（已授权时 resolve 不弹窗）
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
})

function dismissHint() {
  showHint.value = false
  safeSetItem(HINT_KEY, '1')
  // iOS 13+ devicemotion 权限必须由用户手势触发——挂在浮层点击里
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
      if (navigator.vibrate) navigator.vibrate(10)
    }
  }
  window.addEventListener('devicemotion', motionHandler)
}

onUnmounted(() => {
  if (motionHandler) window.removeEventListener('devicemotion', motionHandler)
  if (permissionOnce) window.removeEventListener('pointerdown', permissionOnce)
})

let dragging = false
function onPointerMove(e) {
  if (!dragging && e.buttons !== 1 && e.pointerType !== 'touch') return
  // 拖动搅乱：靠近指针的牌被推开
  const rect = e.currentTarget.getBoundingClientRect()
  const px = ((e.clientX - rect.left) / rect.width - 0.5) * 100
  const py = ((e.clientY - rect.top) / rect.height - 0.5) * 100
  for (const c of cards.value) {
    const dx = c.x - px
    const dy = c.y - py
    const dist = Math.hypot(dx, dy)
    if (dist < 22) {
      c.x += (dx / (dist || 1)) * 6 + (Math.random() - 0.5) * 3
      c.y += (dy / (dist || 1)) * 4 + (Math.random() - 0.5) * 3
      c.r += (Math.random() - 0.5) * 14
      c.x = Math.max(-42, Math.min(42, c.x))
      c.y = Math.max(-28, Math.min(28, c.y))
    }
  }
}

function cut() {
  // 切牌：视觉上分三段重新聚拢再散开
  scatter()
  if (navigator.vibrate) navigator.vibrate(10)
}

function done() {
  if (store.phase !== 'shuffling') return // 防双击
  store.finishShuffle()
  // 代抽快照开启时 finishShuffle 内部已 pickAll，phase 直达 revealing
  router.replace(store.phase === 'revealing' ? '/reading/reveal' : '/reading/pick')
}
</script>

<template>
  <div class="shuffle">
    <p class="tip">拖动搅乱牌堆，或摇一摇手机</p>

    <div
      class="pool"
      @pointerdown="dragging = true"
      @pointerup="dragging = false"
      @pointercancel="dragging = false"
      @pointerleave="dragging = false"
      @pointermove="onPointerMove"
    >
      <div
        v-for="c in cards"
        :key="c.id"
        class="fly"
        :style="{
          transform: `translate(${c.x}%, ${c.y}%) rotate(${c.r}deg)`,
          transitionDelay: c.delay + 'ms'
        }"
      >
        <CardBack class="back" />
      </div>
    </div>

    <div class="actions">
      <button class="ghost" @click="cut">切牌</button>
      <button class="primary" @click="done">洗好了</button>
    </div>

    <div v-if="showHint" class="hint" @click="dismissHint">
      <div class="hint-card">
        <span class="hint-icon">👋</span>
        <p>拖动我，或摇一摇</p>
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
  padding: 48px 20px calc(32px + env(safe-area-inset-bottom, 0px));
}

.tip {
  text-align: center;
  color: var(--moon-dim);
  font-size: 0.875rem;
  letter-spacing: 0.1em;
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
  transition: transform 0.9s cubic-bezier(0.2, 0.7, 0.3, 1);
  pointer-events: none;
}

.actions {
  display: flex;
  gap: 14px;
}

.ghost,
.primary {
  flex: 1;
  padding: 14px;
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
}

.hint {
  position: fixed;
  inset: 0;
  background: rgba(10, 11, 26, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.hint-card {
  background: var(--bg-card);
  border-radius: var(--radius-card);
  padding: 32px 40px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hint-icon {
  font-size: 2rem;
  animation: wave 1.2s ease-in-out infinite;
}

@keyframes wave {
  0%,
  100% {
    transform: translateX(-8px) rotate(-8deg);
  }
  50% {
    transform: translateX(8px) rotate(8deg);
  }
}

.hint-sub {
  font-size: 0.8125rem;
  color: var(--moon-dim);
}

@media (prefers-reduced-motion: reduce) {
  .fly {
    transition: none;
  }
  .hint-icon {
    animation: none;
  }
}
</style>
