<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import cardsData from '../data/cards.json'
import AppIcon from '../components/AppIcon.vue'
import { tap } from '../lib/feedback.js'
import { useReadingStore } from '../stores/reading.js'
import { useJournalStore } from '../stores/journal.js'
import { useLearningStore } from '../stores/learning.js'
import { useProfileStore } from '../stores/profile.js'
import { useSettingsStore } from '../stores/settings.js'
import { PHASE_ROUTE } from '../router/index.js'
import { currentDayKey } from '../lib/day-key.js'
import { calcStreak, calcMaxStreak } from '../lib/streak.js'
import { safeGetItem, safeSetItem } from '../lib/storage.js'
import { streamChat } from '../lib/ai-client.js'
import { buildGreetingMessages } from '../lib/ai-prompts.js'
import { useDeck } from '../lib/use-deck.js'
import { useRitualToday } from '../composables/use-ritual-today.js'

const router = useRouter()
const reading = useReadingStore()
const journal = useJournalStore()
const learning = useLearningStore()
const profile = useProfileStore()
const settings = useSettingsStore()
const { cardUrl } = useDeck()

const cardById = new Map(cardsData.map((c) => [c.id, c]))

// Android 返回手势/误退出后，进行中的占卜仍在（store 或 sessionStorage）——
// 给出「继续占卜」入口，否则 standalone PWA 下没有任何途径回到动线
reading.hasActiveReading()
const activeReading = computed(() => reading.phase !== 'idle' && PHASE_ROUTE[reading.phase])

function resumeReading() {
  tap()
  router.push(PHASE_ROUTE[reading.phase])
}

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 5) return '夜深了，让牌陪你静一静'
  if (h < 11) return '早安，今天想问点什么？'
  if (h < 14) return '午后小憩，抽一张牌吧'
  if (h < 19) return '傍晚好，回顾一下今天'
  return '晚上好，此刻适合占卜'
})

// ---- 每日一抽与连胜 ----
const dailyReading = computed(() => journal.dailyReading(currentDayKey()))
const dailyCardName = computed(() => {
  const id = dailyReading.value?.cards?.[0]?.cardId
  return id ? cardById.get(id)?.name ?? '' : ''
})
const streak = computed(() => calcStreak(Object.keys(journal.dailyDraws), currentDayKey()))
const maxStreak = computed(() => calcMaxStreak(Object.keys(journal.dailyDraws)))
const todayDrawn = computed(() => !!journal.dailyDraws[currentDayKey()])
// 今日未打卡但昨日有连胜：提示「别让连胜断了」
const pendingToday = computed(() => !todayDrawn.value && streak.value > 0)

// ---- 今日小目标：抽 1 张 + 复习 3 张闪卡 ----
const reviewDone = computed(() => learning.todayReviewCount >= 3)
const goalsAllDone = computed(() => todayDrawn.value && reviewDone.value)

// 历史最佳连胜写回 profile（持久化）
watch(maxStreak, (v) => profile.updateMaxStreak(v), { immediate: true })

// ---- 人格化提醒（M4）：AI 每日一次问候，缓存当天；无 key / 失败回退静态问候 ----
// v1.5 Task 2（#15）：问候随人格--缓存带 persona 维度，当天切人格重新生成一次
const GREETING_KEY = 'tarot.greeting.v1'
const aiGreeting = ref('')

onMounted(() => {
  if (!settings.hasAI) return
  try {
    const cached = JSON.parse(safeGetItem(GREETING_KEY) || 'null')
    if (cached && cached.day === currentDayKey() && cached.persona === settings.persona) {
      aiGreeting.value = cached.text
      return
    }
  } catch {
    /* ignore */
  }
  // 生成问候（结合连胜状态；人格由 buildGreetingMessages 内部按 settings 注入）
  const streakText = streak.value >= 7 ? `你已经连续${streak.value}天打卡了` : streak.value > 0 ? `今天是连胜第${streak.value}天` : '新的一天'
  const msgs = buildGreetingMessages(streakText)
  let out = ''
  ;(async () => {
    try {
      for await (const d of streamChat({ messages: msgs })) out += d
      aiGreeting.value = out.trim()
      safeSetItem(GREETING_KEY, JSON.stringify({ day: currentDayKey(), persona: settings.persona, text: out.trim() }))
    } catch {
      /* 失败回退静态问候 */
    }
  })()
})

function greetingText() {
  return aiGreeting.value || greeting.value
}

// 主 CTA：进选牌阵独立页（Task 21，首页不再挂牌阵列表）
function goSpreads() {
  tap()
  router.push('/spreads')
}

function startDaily() {
  if (activeReading.value && !window.confirm('有一局占卜正在进行，开始新的将丢弃它。确定吗？')) {
    return
  }
  if (dailyReading.value) {
    router.push(`/journal/${dailyReading.value.id}`)
    return
  }
  tap()
  reading.reset()
  router.push({ path: '/reading/question', query: { daily: '1' } })
}

function startReading(spreadId) {
  if (activeReading.value && !window.confirm('有一局占卜正在进行，开始新的将丢弃它。确定吗？')) {
    return
  }
  tap()
  reading.reset()
  router.push({ path: '/reading/question', query: { spread: spreadId } })
}

// M5 仪式牌阵（Task 21 起只在首页留一行提示，完整列表在 /spreads）：
// 新月/满月当天或生日窗口命中时出现，点击直达该牌阵，平日不占位。
const { ritualToday, ritualSpread } = useRitualToday()
const RITUAL_PREFIX = { 'new-moon': '今晚新月', 'full-moon': '今晚满月', birthday: '生日将至' }
const ritualPrefix = computed(() => RITUAL_PREFIX[ritualToday.value] ?? '')
const ritualIcon = computed(() => (ritualToday.value === 'birthday' ? 'star' : 'moon'))
</script>

<template>
  <div class="home">
    <header class="home-header">
      <div>
        <h1 class="title wordmark">星语<em>塔罗</em></h1>
        <p class="greeting">{{ greetingText() }}</p>
      </div>
      <router-link to="/welcome" class="help card-press" aria-label="重看新手引导">
        <AppIcon name="help" :size="22" />
      </router-link>
    </header>

    <button v-if="activeReading" class="resume card-press" @click="resumeReading">
      <span class="resume-text">
        <AppIcon name="moon" :size="18" />
        有一局{{ reading.spread?.name ?? '' }}占卜正在进行
      </span>
      <span class="resume-cta">
        继续
        <AppIcon name="arrow" :size="16" />
      </span>
    </button>

    <!-- 主 CTA：首屏可见「开始占卜」，进选牌阵页（Task 17 → Task 21 改为独立页） -->
    <div class="cta-block">
      <button class="cta btn-solid" @click="goSpreads">
        <AppIcon name="reading" :size="20" />
        开始占卜
      </button>

      <!-- 今日限定：仅仪式日出现，直达该牌阵 -->
      <button v-if="ritualSpread" class="ritual-row" @click="startReading(ritualToday)">
        <AppIcon :name="ritualIcon" :size="16" />
        <span class="ritual-text">{{ ritualPrefix }} · {{ ritualSpread.name }}</span>
        <span class="recommend">今日限定</span>
      </button>
    </div>

    <!-- 今日小目标 -->
    <section class="goals card">
      <p class="goals-title">
        <template v-if="goalsAllDone">今日已圆满</template>
        <template v-else>今日小目标</template>
      </p>
      <div class="goal">
        <span class="goal-dot" :class="{ done: todayDrawn }"><AppIcon :name="todayDrawn ? 'check' : 'star'" :size="14" /></span>
        <span class="goal-text">抽 1 张牌</span>
      </div>
      <div class="goal">
        <span class="goal-dot" :class="{ done: reviewDone }"><AppIcon :name="reviewDone ? 'check' : 'deck'" :size="14" /></span>
        <span class="goal-text">复习 {{ learning.todayReviewCount }}/3 张闪卡</span>
      </div>
    </section>

    <!-- 每日一抽大卡 -->
    <button class="daily card-press" :class="{ done: dailyReading }" @click="startDaily">
      <img
        v-if="dailyReading"
        class="daily-thumb"
        :src="cardUrl(dailyReading.cards?.[0]?.cardId)"
        :alt="dailyCardName"
      />
      <span v-else class="daily-icon"><AppIcon name="star" :size="26" /></span>
      <span class="daily-main">
        <b>{{ dailyReading ? '今日已抽 · ' + dailyCardName : '每日一抽' }}</b>
        <span class="daily-sub">{{ dailyReading ? '点击回看今天的指引' : '抽一张牌，与今天的自己对话' }}</span>
      </span>
      <span class="daily-streak">
        <span class="streak-n">{{ streak }}</span>
        <span class="streak-label">天连胜</span>
      </span>
    </button>
    <p class="streak-meta">
      <template v-if="dailyReading">今日已打卡</template>
      <template v-else-if="pendingToday">今天还没打卡，别让连胜断了</template>
      <template v-else>连续打卡，积累你的仪式感</template>
      · 历史最佳 {{ maxStreak }} 天
    </p>

    <section class="learn-entry">
      <router-link to="/learn" class="learn-card card-dashed">
        <AppIcon name="learn" :size="22" />
        <span class="learn-text"><b>从零学塔罗</b> · 7 章新手课程</span>
      </router-link>
    </section>
  </div>
</template>

<style scoped>
.home {
  padding: var(--sp-3) 20px var(--sp-4);
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--sp-4);
}

.title {
  font-size: 1.625rem;
  margin-bottom: 6px;
}

.greeting {
  color: var(--dim);
  font-size: var(--fs-body);
}

.help {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: var(--dim);
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  flex-shrink: 0;
}

/* 续局：唯一允许抢眼的入口——金框 + 金底 */
.resume {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-1);
  border-color: var(--gold-deep);
  background: var(--gold-soft);
  color: var(--gold-text);
  padding: 14px 16px;
  margin-bottom: var(--sp-3);
  font-size: var(--fs-body);
  font-weight: var(--w-strong);
}

.resume-text,
.resume-cta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.resume-cta {
  flex-shrink: 0;
}

/* 每日一抽 */
.daily {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 16px;
  margin-bottom: 8px;
  background: var(--gold-soft);
  border-color: var(--gold-deep);
}

.daily-icon {
  color: var(--gold-text);
}

.daily-thumb {
  width: 52px;
  aspect-ratio: 300 / 527;
  border-radius: var(--radius-img);
  object-fit: cover;
  box-shadow: var(--shadow-card);
  flex-shrink: 0;
}

.daily-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.daily-main b {
  font-size: var(--fs-head);
  color: var(--gold-text);
}

.daily-sub {
  font-size: var(--fs-note);
  color: var(--dim);
}

.daily-streak {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--gold-text);
}

.streak-n {
  font-size: 1.5rem;
  font-weight: var(--w-title);
  line-height: 1;
}

.streak-label {
  font-size: 0.6875rem;
  color: var(--dim);
}

.streak-meta {
  font-size: 0.75rem;
  color: var(--dim);
  text-align: center;
  margin-bottom: var(--sp-3);
}

.cta-block {
  margin-bottom: var(--sp-3);
}

.cta {
  width: 100%;
  padding: 16px;
  font-size: var(--fs-head);
}

/* 今日限定提示行：贴在 CTA 下，仪式日才出现 */
.ritual-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 8px 4px;
  background: none;
  border: none;
  color: var(--gold-text);
  font-family: var(--sans);
  font-size: var(--fs-note);
  font-weight: var(--w-strong);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--t-press) var(--ease-out);
}

.ritual-row:active {
  transform: scale(0.98);
}

.ritual-row:focus-visible {
  outline: 2px solid var(--gold-text);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.ritual-text {
  flex: 1;
  min-width: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.goals {
  padding: 14px 16px;
  margin-bottom: var(--sp-3);
}

.goals-title {
  font-size: var(--fs-note);
  font-weight: var(--w-strong);
  color: var(--gold-text);
  margin-bottom: 8px;
}

.goal {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.goal-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sunk);
  color: var(--dim);
}

.goal-dot.done {
  background: var(--gold-soft);
  color: var(--gold-text);
}

.goal-text {
  font-size: var(--fs-body);
  color: var(--dim);
}

.recommend {
  font-size: 0.625rem;
  font-weight: var(--w-strong);
  color: var(--on-gold);
  background: var(--gold);
  border-radius: var(--radius-pill);
  padding: 2px 8px;
  flex-shrink: 0;
}

.learn-entry {
  margin-top: var(--sp-4);
}

.learn-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 16px;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: var(--w-medium);
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--t-press) var(--ease-out), border-color var(--t-press);
}

.learn-card:active {
  transform: scale(0.98);
  border-color: var(--gold-deep);
}

.learn-text b {
  color: var(--ink);
  font-weight: var(--w-title);
}
</style>
