<script setup>
// 抽牌页：78 张牌背横排滑动，逐张点选（选中金色描边）；「帮我抽完」一键补满。
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useReadingStore } from '../../stores/reading.js'
import CardBack from '../../components/CardBack.vue'

const TOTAL = 78

const router = useRouter()
const store = useReadingStore()

const picked = computed(() => store.drawn.length)
const target = computed(() => store.cardCount)
const currentPosition = computed(() => store.spread?.positions[picked.value]?.label ?? '')

function toReveal() {
  router.replace('/reading/reveal')
}

function pick(index) {
  if (store.pickedIndices.includes(index) || store.phase !== 'picking') return
  store.pickCard(index)
  if (navigator.vibrate) navigator.vibrate(10)
  if (store.phase === 'revealing') toReveal()
}

function pickRest() {
  if (store.phase !== 'picking') return
  store.pickAll()
  toReveal()
}
</script>

<template>
  <div class="pick">
    <header class="head">
      <p class="progress">
        已选 <span class="gold">{{ picked }}</span> / {{ target }}
      </p>
      <p class="pos-hint">
        <template v-if="currentPosition">下一张放入：「{{ currentPosition }}」</template>
      </p>
    </header>

    <div class="strip-wrap">
      <div class="strip">
        <button
          v-for="i in TOTAL"
          :key="i"
          class="slot"
          :class="{ taken: store.pickedIndices.includes(i - 1) }"
          @click="pick(i - 1)"
        >
          <CardBack :selected="store.pickedIndices.includes(i - 1)" />
        </button>
      </div>
    </div>

    <div class="slots">
      <div
        v-for="(pos, i) in store.spread?.positions ?? []"
        :key="pos.key"
        class="dest"
        :class="{ filled: i < picked }"
      >
        <span class="dest-label">{{ pos.label }}</span>
      </div>
    </div>

    <button class="auto" @click="pickRest">帮我抽完</button>
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
  margin-bottom: 20px;
}

.progress {
  font-size: 1.0625rem;
  letter-spacing: 0.1em;
}

.gold {
  color: var(--gold-bright);
}

.pos-hint {
  margin-top: 6px;
  font-size: 0.8125rem;
  color: var(--moon-dim);
  min-height: 1.2em;
}

.strip-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding: 20px 0;
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
  opacity: 0.25;
  cursor: default;
}

.slots {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 16px 20px 20px;
}

.dest {
  min-width: 52px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px dashed var(--moon-dim);
  text-align: center;
  opacity: 0.55;
  transition: all 0.3s;
}

.dest.filled {
  border: 1px solid var(--gold);
  background: rgba(184, 145, 47, 0.14);
  opacity: 1;
}

.dest-label {
  font-size: 0.6875rem;
  color: var(--moon-dim);
}

.dest.filled .dest-label {
  color: var(--gold-bright);
}

.auto {
  margin: 0 20px;
  padding: 13px;
  border-radius: var(--radius-card);
  border: 1px solid var(--gold);
  background: none;
  color: var(--gold-bright);
  font-size: 0.9375rem;
  font-family: var(--sans);
  cursor: pointer;
}
</style>
