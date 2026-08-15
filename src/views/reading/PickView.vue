<script setup>
// 抽牌页（Task 16 改版）：点牌 → 内联选中态（上浮+金边+金辉，槽位呼吸描边），
// 底部固定确认栏「放入「位置」」；点其他牌 = 选中转移，再点选中牌或 Esc = 取消。
// 键盘（桌面）：数字键选中、Enter 放入、Esc 取消。
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReadingStore } from '../../stores/reading.js'
import CardBack from '../../components/CardBack.vue'
import AppIcon from '../../components/AppIcon.vue'
import FlowExit from '../../components/FlowExit.vue'
import { tap, success } from '../../lib/feedback.js'

const TOTAL = 78

const router = useRouter()
const store = useReadingStore()

const picked = computed(() => store.drawn.length)
const target = computed(() => store.cardCount)
const currentPosition = computed(() => store.spread?.positions[picked.value]?.label ?? '')
const selectedIndex = ref(null) // 当前选中（未放入）的牌背下标；null = 无选中

function toReveal() {
  router.replace('/reading/reveal')
}

// 点牌：若该牌已被放入 → 忽略；若正被选中 → 取消；否则进入选中态
function pick(index) {
  if (store.phase !== 'picking') return
  if (store.pickedIndices.includes(index)) return
  if (selectedIndex.value === index) {
    selectedIndex.value = null
    return
  }
  selectedIndex.value = index
  tap()
}

// 确认放入
function place() {
  if (selectedIndex.value == null || store.phase !== 'picking') return
  const index = selectedIndex.value
  selectedIndex.value = null
  store.pickCard(index)
  // 选满即完成时刻：手感与普通点选区分
  if (store.phase === 'revealing') {
    success()
    toReveal()
  } else {
    success()
  }
}

function pickRest() {
  if (store.phase !== 'picking') return
  store.pickAll()
  success() // 完成时刻：与手动选满的手感一致
  toReveal()
}

// 桌面键盘（Task 12/16 微调）：数字键=选中、Enter=放入、Esc=取消选中
function onKey(e) {
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return // 输入框内不劫持
  if (store.phase !== 'picking') return
  if (e.key === 'Enter') {
    // 焦点在按钮上（如「退出」「确认」）时放行原生 click，不被全局拦截转为放牌
    if (document.activeElement?.tagName === 'BUTTON') return
    if (selectedIndex.value != null) {
      e.preventDefault()
      place()
    }
    return
  }
  if (e.key === 'Escape') {
    selectedIndex.value = null
    return
  }
  if (!/^[1-9]$/.test(e.key)) return
  let n = Number(e.key)
  for (let i = 0; i < TOTAL; i++) {
    if (!store.pickedIndices.includes(i)) {
      n--
      if (n === 0) {
        selectedIndex.value = i
        tap()
        return
      }
    }
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="pick">
    <FlowExit confirm />
    <header class="head">
      <p class="progress">
        已选 <span class="gold">{{ picked }}</span> / {{ target }}
      </p>
      <p class="pos-hint">
        <template v-if="currentPosition">下一张放入：「{{ currentPosition }}」</template>
      </p>
    </header>

    <!-- 目标槽位放在牌堆之前：抽的时候始终看得见「这张要去哪」 -->
    <div class="slots">
      <div
        v-for="(pos, i) in store.spread?.positions ?? []"
        :key="pos.key"
        class="dest"
        :class="{ filled: i < picked, active: i === picked }"
      >
        <span class="dest-label">{{ pos.label }}</span>
        <AppIcon v-if="i < picked" class="dest-check" name="check" :size="12" />
      </div>
    </div>

    <div class="strip-wrap">
      <div class="strip">
        <button
          v-for="i in TOTAL"
          :key="i"
          class="slot"
          :class="{ taken: store.pickedIndices.includes(i - 1), picked: selectedIndex === i - 1 }"
          @click="pick(i - 1)"
        >
          <CardBack :selected="store.pickedIndices.includes(i - 1) || selectedIndex === i - 1" />
        </button>
      </div>
    </div>

    <button class="auto btn-ghost btn-block" @click="pickRest">帮我抽完</button>

    <!-- 底部固定确认栏（内联选中态，非弹窗） -->
    <div v-if="selectedIndex !== null" class="confirm-bar">
      <button class="btn-solid" @click="place">放入「{{ currentPosition }}」</button>
    </div>
  </div>
</template>

<style scoped>
.pick {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 40px 0 calc(28px + env(safe-area-inset-bottom, 0px));
}

.head {
  text-align: center;
  padding: 0 20px;
  margin-bottom: 14px;
}

.progress {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  letter-spacing: 0.1em;
}

.gold {
  color: var(--gold-text);
  font-size: 1.25rem;
}

.pos-hint {
  margin-top: 5px;
  font-size: var(--fs-note);
  color: var(--dim);
  min-height: 1.2em;
}

.strip-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  /* 上下留白给选中牌的上浮与金辉，避免被裁切 */
  padding: 28px 0 20px;
}

.strip {
  display: flex;
  padding: 0 24px;
}

.slot {
  flex: none;
  width: 88px;
  margin-right: -44px; /* 扇形叠放：有效命中区 44px（触控标准） */
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: opacity 0.3s;
}

.slot:last-child {
  margin-right: 24px;
}

/* 保留 pointer-events：点已抽的牌由 pick() 静默忽略。
   若设 pointer-events:none 点击会穿透到被压在下面的邻牌，静默误耗名额 */
.slot.taken {
  opacity: 0.32;
  cursor: default;
}

/* 选中牌层级提升：扇形叠放下右侧金边/金辉不被右邻牌压住（勿用 :has()，兼容红线） */
.slot.picked {
  position: relative;
  z-index: 1;
}

.slots {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--sp-1);
  padding: 0 20px;
}

.dest {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 56px;
  justify-content: center;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  border: 2px dashed var(--line);
  text-align: center;
  opacity: 0.6;
  transition: opacity var(--t-fast), border-color var(--t-fast), background var(--t-fast);
}

/* 刚落位的槽位轻弹一下：这一张确实放进去了 */
.dest.filled {
  border-style: solid;
  border-color: var(--gold-deep);
  background: var(--gold-soft);
  opacity: 1;
  animation: pop var(--t-mid) var(--ease-pop) both;
}

/* 下一张的目的地：呼吸描边指路 */
.dest.active {
  border-color: var(--gold);
  opacity: 1;
  animation: pulse-line 1.6s ease-in-out infinite;
}

@keyframes pulse-line {
  0%,
  100% {
    box-shadow: 0 0 0 0 var(--gold-glow);
  }
  50% {
    box-shadow: 0 0 0 4px var(--gold-glow);
  }
}

.dest-label,
.dest-check {
  font-size: 0.6875rem;
  font-weight: var(--w-strong);
  color: var(--dim);
}

.dest.filled .dest-label,
.dest.filled .dest-check,
.dest.active .dest-label {
  color: var(--gold-text);
}

.auto {
  margin: 0 20px;
}

/* 底部固定确认栏：不遮挡牌堆，靠近「帮我抽完」上方 */
.confirm-bar {
  position: fixed;
  left: 20px;
  right: 20px;
  bottom: calc(86px + env(safe-area-inset-bottom, 0px));
  z-index: 15;
}

.confirm-bar .btn-solid {
  width: 100%;
}
</style>
