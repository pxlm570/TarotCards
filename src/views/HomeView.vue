<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import spreads from '../data/spreads.json'
import cardsData from '../data/cards.json'
import AppIcon from '../components/AppIcon.vue'
import { tap } from '../lib/feedback.js'
import { useReadingStore } from '../stores/reading.js'
import { useJournalStore } from '../stores/journal.js'
import { PHASE_ROUTE } from '../router/index.js'
import { currentDayKey } from '../lib/day-key.js'
import { calcStreak, calcMaxStreak } from '../lib/streak.js'

const router = useRouter()
const reading = useReadingStore()
const journal = useJournalStore()

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
const today = currentDayKey()
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
  router.push({ path: '/reading/breathe', query: { daily: '1' } })
}

function startReading(spreadId) {
  if (activeReading.value && !window.confirm('有一局占卜正在进行，开始新的将丢弃它。确定吗？')) {
    return
  }
  tap()
  reading.reset()
  router.push({ path: '/reading/breathe', query: { spread: spreadId } })
}
</script>

<template>
  <div class="home">
    <header class="home-header">
      <div>
        <h1 class="title wordmark">星语<em>塔罗</em></h1>
        <p class="greeting">{{ greeting }}</p>
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

    <!-- 每日一抽大卡 -->
    <button class="daily card-press" :class="{ done: dailyReading }" @click="startDaily">
      <span class="daily-icon"><AppIcon name="star" :size="26" /></span>
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

    <section class="spreads">
      <h2 class="section-title">选择牌阵</h2>
      <button
        v-for="(spread, i) in spreads"
        :key="spread.id"
        class="spread-card card-press stagger-item"
        :style="{ '--i': i }"
        @click="startReading(spread.id)"
      >
        <span class="spread-n">
          {{ spread.cardCount }}
          <small>张</small>
        </span>
        <span class="spread-info">
          <span class="spread-name">{{ spread.name }}</span>
          <span class="spread-desc">{{ spread.positions.map((p) => p.label).join(' · ') }}</span>
        </span>
        <span class="badge" :class="{ 'badge-plain': spread.difficulty === '进阶' }">{{ spread.difficulty }}</span>
      </button>
    </section>

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

.section-title {
  font-size: var(--fs-head);
  margin-bottom: 14px;
}

.spread-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  margin-bottom: 12px;
}

.spread-n {
  min-width: 44px;
  text-align: center;
  font-size: 1.625rem;
  font-weight: var(--w-title);
  color: var(--gold-text);
  line-height: 1;
}

.spread-n small {
  display: block;
  font-size: 0.6875rem;
  font-weight: var(--w-medium);
  color: var(--dim);
  letter-spacing: 0.1em;
  margin-top: 3px;
}

.spread-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.spread-name {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
}

.spread-desc {
  max-width: 100%;
  font-size: var(--fs-note);
  color: var(--dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
