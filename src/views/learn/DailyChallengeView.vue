<script setup>
// 每日挑战（#6）：从已学章节随机抽 3 题，低调可选入口，完成有记录与奖励，不强制。
// 题数定死 3：第一章题池恰好 3 道（新用户只有第一章可抽），写 5 会文案与实际不符。
import { ref, computed } from 'vue'
import chapters from '../../data/courses/index.json'
import { useLearningStore } from '../../stores/learning.js'
import { useProfileStore } from '../../stores/profile.js'
import { useDeck } from '../../lib/use-deck.js'
import { safeGetItem, safeSetItem } from '../../lib/storage.js'
import { currentDayKey } from '../../lib/day-key.js'
import { tap, success, toast } from '../../lib/feedback.js'
import AppIcon from '../../components/AppIcon.vue'
import { useBack } from '../../composables/use-back.js'

const CHAPTER_MODULES = import.meta.glob('../../data/courses/chapter-*.json', { eager: true })
const learning = useLearningStore()
const profile = useProfileStore()
const { cardUrl } = useDeck()
const goBack = useBack()

const CHALLENGE_KEY = 'tarot.challenge.v1' // { count, last }
const QUESTION_COUNT = 3

// 从已学章节收集所有测验题
const pool = computed(() => {
  const items = []
  for (const c of chapters) {
    if (!learning.unlocked.includes(c.id)) continue
    const data = CHAPTER_MODULES[`../../data/courses/chapter-${String(c.order).padStart(2, '0')}.json`]?.default
    for (const l of data?.lessons ?? []) {
      if (l.type === 'quiz') for (const q of l.questions) items.push(q)
    }
  }
  return items
})

const questions = ref([])
const started = ref(false)

function start() {
  const arr = [...pool.value]
  // 打乱取前 3
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  questions.value = arr.slice(0, QUESTION_COUNT)
  started.value = true
}

// ---- 答题（四题型，无限重试当前题） ----
const index = ref(0)
const multiSel = ref([])
const wrongMsg = ref('')
const finished = ref(false)

const current = computed(() => questions.value[index.value])
const type = computed(() => current.value?.type ?? 'single')

function pick(oi) {
  const q = current.value
  if (q.type === 'multi') {
    multiSel.value = multiSel.value.includes(oi) ? multiSel.value.filter((x) => x !== oi) : [...multiSel.value, oi]
    return
  }
  tap()
  if (oi === q.answer) advance()
  else wrongMsg.value = q.explain
}

function confirmMulti() {
  const q = current.value
  const ans = Array.isArray(q.answer) ? q.answer : []
  const ok = multiSel.value.length === ans.length && ans.every((a) => multiSel.value.includes(a))
  if (ok) advance()
  else wrongMsg.value = q.explain
}

function advance() {
  success()
  if (index.value + 1 >= questions.value.length) finish()
  else {
    index.value++
    multiSel.value = []
    wrongMsg.value = ''
  }
}

function finish() {
  finished.value = true
  let rec = { count: 0, last: '' }
  try {
    rec = { ...rec, ...(JSON.parse(safeGetItem(CHALLENGE_KEY)) || {}) }
  } catch {
    /* 损坏按空记录处理，不让奖励静默丢失 */
  }
  const today = currentDayKey()
  if (rec.last === today) return // 每日只发一次奖励（旧版可无限刷 +10 XP）
  rec.count += 1
  rec.last = today
  safeSetItem(CHALLENGE_KEY, JSON.stringify(rec))
  profile.addXp(10) // 每日挑战奖励
  toast('挑战完成 +10 XP', 'success')
}
</script>

<template>
  <div class="challenge">
    <header class="head">
      <button class="back btn-text" @click="goBack('/learn')"><AppIcon name="arrow" :size="16" style="transform: rotate(180deg)" /> 学习</button>
      <h1 class="title">每日挑战</h1>
      <p class="sub">从已学章节随机抽 3 题 · 做完有记录和奖励 · 不做也不影响</p>
    </header>

    <div v-if="!started && pool.length === 0" class="empty card">
      <p>先学完一章，挑战题目就会从这里来。</p>
    </div>
    <button v-else-if="!started" class="btn-solid btn-block" @click="start">开始挑战（3 题）</button>

    <template v-else-if="started && !finished">
      <div class="bar">
        <span class="bar-num">第 {{ index + 1 }} / {{ questions.length }} 题</span>
        <div class="track"><div class="fill" :style="{ width: (index / questions.length) * 100 + '%' }" /></div>
      </div>

      <div class="q card" :key="index">
        <p v-if="type !== 'image'" class="q-text">{{ current.q }}</p>
        <p v-else class="q-text">这张牌是哪一张？</p>
        <div v-if="type === 'image' || type === 'orientation'" class="q-img-wrap">
          <img v-if="cardUrl(current.cardId)" class="q-img" :src="cardUrl(current.cardId)" alt="" />
          <div v-else class="q-img skeleton" />
        </div>
        <div class="opts">
          <button
            v-for="(opt, oi) in current.options"
            :key="oi"
            class="opt"
            :class="{ sel: type === 'multi' && multiSel.includes(oi) }"
            @click="pick(oi)"
          >{{ opt }}</button>
        </div>
        <p v-if="wrongMsg" class="explain">提示：{{ wrongMsg }}</p>
        <div v-if="type === 'multi'" class="multi-actions">
          <button class="btn-solid btn-block" :disabled="multiSel.length === 0" @click="confirmMulti">确认</button>
        </div>
        <button v-if="wrongMsg && type !== 'multi'" class="btn-ghost btn-block retry" @click="wrongMsg = ''">再试一次</button>
      </div>
    </template>

    <div v-else class="done card">
      <p class="done-title">挑战完成</p>
      <p class="done-hint">+10 XP。明天再来玩。</p>
      <button class="btn-ghost btn-block" @click="goBack('/learn')">返回</button>
    </div>
  </div>
</template>

<style scoped>
.challenge {
  padding: var(--sp-3) 20px calc(40px + env(safe-area-inset-bottom, 0px));
}
.back { display: inline-flex; align-items: center; gap: 4px; padding-left: 0; margin-bottom: 8px; }
.title { font-size: var(--fs-title); }
.sub { font-size: var(--fs-note); color: var(--dim); margin: 6px 0 var(--sp-3); line-height: 1.7; }
.bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.bar-num { font-size: var(--fs-note); color: var(--dim); flex-shrink: 0; }
.track { flex: 1; height: 8px; border-radius: var(--radius-pill); background: var(--sunk); overflow: hidden; }
.fill { height: 100%; background: var(--gold); transition: width var(--t-mid); }
.q { padding: var(--sp-2); }
.q-text { font-size: var(--fs-body); font-weight: var(--w-strong); margin-bottom: 12px; }
.q-img-wrap { display: flex; justify-content: center; margin-bottom: 12px; }
.q-img { width: 130px; aspect-ratio: 300/527; border-radius: var(--radius-img); object-fit: cover; box-shadow: var(--shadow-card); }
.opts { display: flex; flex-direction: column; gap: 8px; }
.opt { text-align: left; padding: 11px 14px; border-radius: var(--radius-sm); background: var(--surface); border: 2px solid var(--line); border-bottom-width: 3px; color: var(--ink); font-size: var(--fs-body); cursor: pointer; }
.opt.sel { border-color: var(--gold-deep); background: var(--gold-soft); }
.explain { margin-top: 10px; font-size: var(--fs-note); color: var(--coral); }
.multi-actions { margin-top: 12px; }
.retry { margin-top: 12px; }
.done { padding: var(--sp-3); text-align: center; }
.done-title { font-size: var(--fs-head); font-weight: var(--w-title); color: var(--gold-text); margin-bottom: 6px; }
.done-hint { font-size: var(--fs-note); color: var(--dim); margin-bottom: 12px; }
.empty { padding: var(--sp-3); text-align: center; color: var(--dim); }
</style>
