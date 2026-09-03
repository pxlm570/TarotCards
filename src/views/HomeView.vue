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
import { levelProgress, levelCardId } from '../lib/xp.js'
import { safeGetItem, safeSetItem } from '../lib/storage.js'
import { buildGreetingMessages } from '../lib/ai-prompts.js'
import { useDeck } from '../lib/use-deck.js'
import { useRitualToday } from '../composables/use-ritual-today.js'
import { useStream } from '../composables/use-stream.js'

const router = useRouter()
const reading = useReadingStore()
const journal = useJournalStore()
const learning = useLearningStore()
const profile = useProfileStore()
const settings = useSettingsStore()
const { cardUrl, backUrl } = useDeck()

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
const dailyFaceUrl = computed(() => {
  const id = dailyReading.value?.cards?.[0]?.cardId
  return id ? cardUrl(id) : ''
})
const streak = computed(() => calcStreak(Object.keys(journal.dailyDraws), currentDayKey()))
const maxStreak = computed(() => calcMaxStreak(Object.keys(journal.dailyDraws)))
const todayDrawn = computed(() => !!journal.dailyDraws[currentDayKey()])
// 今日未打卡但昨日有连胜：提示「别让连胜断了」
const pendingToday = computed(() => !todayDrawn.value && streak.value > 0)

// ---- 顶栏状态胶囊（2026-09-03 多邻国风改版）：火焰连胜 + 等级 ----
const level = computed(() => levelProgress(profile.xp).level)
const levelName = computed(() => cardById.get(levelCardId(level.value))?.name ?? '')

// ---- 今日小目标：抽 1 张 + 复习 3 张闪卡 ----
const reviewDone = computed(() => learning.todayReviewCount >= 3)
const goalsAllDone = computed(() => todayDrawn.value && reviewDone.value)

// 历史最佳连胜写回 profile（持久化）
watch(maxStreak, (v) => profile.updateMaxStreak(v), { immediate: true })

// ---- 首页 hero「星光牌阵」（2026-09-01 用户三方向样张定稿）----
// 五张牌背扇形弧排 + 星尘穹顶；中央牌即每日一抽入口，已抽翻正显示当日牌面。
// 纯 CSS + 现有牌背/牌面资产，零新增图片；动效走 data-motion / prefers-reduced-motion 降级。
const FAN_SLOTS = [
  { r: -16, ty: 30 },
  { r: -8, ty: 10 },
  { r: 0, ty: 0 },
  { r: 8, ty: 10 },
  { r: 16, ty: 30 }
]
const fanOn = ref(false)
onMounted(() => {
  setTimeout(() => {
    fanOn.value = true
  }, 80)
})

// ---- 人格化提醒（M4）：AI 每日一次问候，缓存当天；无 key / 失败回退静态问候 ----
// v1.5 Task 2（#15）：问候随人格--缓存带 persona 维度，当天切人格重新生成一次。
// 流式生命周期走 useStream（卸载即中止），成功才写当日缓存；此前手搓 IIFE 无 signal、
// 卸载不中止——b2ac4a4 同族漏网第三处。
const GREETING_KEY = 'tarot.greeting.v1'
const aiGreeting = ref('')

const greetingStream = useStream(
  () => {
    const streakText = streak.value >= 7 ? `你已经连续${streak.value}天打卡了` : streak.value > 0 ? `今天是连胜第${streak.value}天` : '新的一天'
    return buildGreetingMessages(streakText)
  },
  {
    onDone: (full) => {
      const t = full.trim()
      if (!t) return
      aiGreeting.value = t
      safeSetItem(GREETING_KEY, JSON.stringify({ day: currentDayKey(), persona: settings.persona, text: t }))
    }
  }
)

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
  greetingStream.start()
})

function greetingText() {
  return aiGreeting.value || greeting.value
}

// 主 CTA：进选牌阵独立页（Task 17 → Task 21 改为独立页）
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
const RITUAL_PREFIX = {
  'new-moon': '今晚新月',
  'full-moon': '今晚满月',
  birthday: '生日将至',
  'spring-equinox': '今日春分',
  'summer-solstice': '今日夏至',
  'autumn-equinox': '今日秋分',
  'winter-solstice': '今日冬至'
}
const ritualPrefix = computed(() => RITUAL_PREFIX[ritualToday.value] ?? '')
const ritualIcon = computed(() => {
  if (ritualToday.value === 'birthday') return 'star'
  if (ritualToday.value?.endsWith('-equinox') || ritualToday.value?.endsWith('-solstice')) return 'sun'
  return 'moon'
})
</script>

<template>
  <div class="home">
    <header class="home-header">
      <h1 class="title wordmark">星语<em>塔罗</em></h1>
      <div class="stat-group">
        <span class="pill fire" :class="{ cold: streak === 0 }" :aria-label="`连续打卡 ${streak} 天`">
          <AppIcon name="flame" :size="16" />
          <b>{{ streak }}</b>
        </span>
        <span class="pill xp" :aria-label="`等级 Lv.${level} ${levelName}`">
          <AppIcon name="star" :size="15" />
          <span class="pill-text">Lv.{{ level }} <b>{{ levelName }}</b></span>
        </span>
        <router-link to="/welcome" class="pill help" aria-label="重看新手引导">
          <AppIcon name="help" :size="19" />
        </router-link>
      </div>
    </header>

    <!-- hero：星光牌阵，中央牌 = 每日一抽入口 -->
    <section class="hero">
      <div class="stars" aria-hidden="true" />
      <div class="fan" :class="{ on: fanOn }">
        <template v-for="(s, i) in FAN_SLOTS" :key="i">
          <button
            v-if="i === 2"
            type="button"
            class="fan-card center"
            :style="{ '--r': s.r + 'deg', '--ty': s.ty + 'px', '--i': i }"
            aria-label="每日一抽"
            @click="startDaily"
          >
            <img v-if="dailyReading && dailyFaceUrl" :src="dailyFaceUrl" :alt="dailyCardName" />
            <img v-else-if="backUrl()" :src="backUrl()" alt="每日一抽" />
            <span v-else class="ph" />
          </button>
          <div v-else class="fan-card" :style="{ '--r': s.r + 'deg', '--ty': s.ty + 'px', '--i': i }" aria-hidden="true">
            <img v-if="backUrl()" :src="backUrl()" alt="" />
            <span v-else class="ph" />
          </div>
        </template>
      </div>
      <p class="fan-hint">{{ dailyReading ? `今日已抽 · ${dailyCardName}` : '点中央的牌，抽今日一抽' }}</p>
      <p class="greeting">{{ greetingText() }}</p>
    </section>

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

    <!-- 主 CTA：首屏可见「开始占卜」，进选牌阵页 -->
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
        <span class="goal-text">复习 {{ learning.todayReviewCount }}/3 张卡牌</span>
      </div>
    </section>

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
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 1.125rem;
  margin-right: auto;
  white-space: nowrap;
}

/* ---- 顶栏状态胶囊（2026-09-03 多邻国风改版，方案一全彩实底）---- */
.stat-group {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 11px;
  border-radius: 999px;
  font-size: 0.8125rem;
  line-height: 1;
  white-space: nowrap;
  user-select: none;
}

.pill b {
  font-size: 0.9375rem;
  line-height: 1;
  font-weight: var(--w-strong);
}

.pill-text {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
}

/* 火焰＝连胜荣誉位：--fire 比品牌珊瑚红深一档，白字达 AA（token 注释有对比度） */
.pill.fire {
  padding: 8px 12px;
  background: var(--fire);
  color: #fff;
  box-shadow: 0 3px 0 var(--fire-deep);
}

/* 连胜 0：灰态，不冒火 */
.pill.fire.cold {
  background: var(--sunk);
  color: var(--dim);
  box-shadow: 0 3px 0 var(--line);
}

.pill.xp {
  background: var(--gold);
  color: var(--on-gold);
  box-shadow: 0 3px 0 var(--gold-deep);
}

/* 帮助：唯一的交互位，按压下沉 */
.pill.help {
  padding: 8px 10px;
  background: var(--ink);
  color: var(--bg);
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3);
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--t-press) var(--ease-out), box-shadow var(--t-press) var(--ease-out);
}

.pill.help:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
}

/* ---- hero：星尘穹顶 + 牌阵（2026-09-01 定稿「星光牌阵」）---- */
.hero {
  position: relative;
  margin: 0 -20px;
  padding: 30px 0 10px;
  overflow: hidden;
  background: radial-gradient(130% 100% at 50% 0%, var(--gold-soft) 0%, transparent 58%);
}

[data-theme="dark"] .hero {
  background: radial-gradient(130% 100% at 50% 0%, var(--surface) 0%, transparent 62%);
}

.stars {
  position: absolute;
  inset: 0;
  pointer-events: none;
  animation: twinkle 4s ease-in-out infinite alternate;
  background-image:
    radial-gradient(1.5px 1.5px at 18% 30%, var(--gold-text), transparent 60%),
    radial-gradient(1px 1px at 32% 18%, var(--dim), transparent 60%),
    radial-gradient(1.5px 1.5px at 55% 24%, var(--gold), transparent 60%),
    radial-gradient(1px 1px at 70% 14%, var(--dim), transparent 60%),
    radial-gradient(1.5px 1.5px at 82% 34%, var(--gold-text), transparent 60%),
    radial-gradient(1px 1px at 12% 55%, var(--dim), transparent 60%),
    radial-gradient(1px 1px at 90% 60%, var(--dim), transparent 60%),
    radial-gradient(1.5px 1.5px at 44% 10%, var(--gold), transparent 60%);
}

@keyframes twinkle {
  from { opacity: 0.55; }
  to { opacity: 0.95; }
}

.fan {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  height: 218px;
}

.fan-card {
  position: relative;
  width: 90px;
  aspect-ratio: 500 / 878;
  margin-left: -28px;
  border-radius: var(--radius-img);
  background: var(--sunk);
  box-shadow: var(--shadow-card);
  transform-origin: 50% 130%;
  transform: rotate(0deg) translateY(22px) scale(0.94);
  opacity: 0;
  transition:
    transform var(--t-slow) var(--ease-out) calc(var(--i) * 90ms),
    opacity var(--t-mid) ease calc(var(--i) * 90ms);
}

.fan .fan-card:first-child {
  margin-left: 0;
}

.fan.on .fan-card {
  opacity: 1;
  transform: rotate(var(--r)) translateY(var(--ty));
}

.fan-card img,
.ph {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
  display: block;
}

.fan-card.center {
  width: 114px;
  z-index: 2;
  padding: 0;
  border: 1px solid var(--gold-deep);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  box-shadow: 0 10px 24px var(--gold-glow), var(--shadow-card);
}

.fan.on .fan-card.center {
  animation: halo 3.2s ease-in-out infinite;
}

@keyframes halo {
  0%, 100% { box-shadow: 0 10px 24px var(--gold-glow), var(--shadow-card); }
  50% { box-shadow: 0 10px 28px var(--gold-glow), 0 0 0 6px var(--gold-soft), var(--shadow-card); }
}

.fan-hint {
  text-align: center;
  margin-top: 16px;
  font-size: var(--fs-note);
  font-weight: var(--w-strong);
  color: var(--gold-text);
}

.greeting {
  text-align: center;
  margin: 4px 0 var(--sp-3);
  color: var(--dim);
  font-size: var(--fs-body);
}

/* ---- 动效降级：系统偏好 + app 内设置 ---- */
@media (prefers-reduced-motion: reduce) {
  .fan-card { transition: none; }
  .fan.on .fan-card.center, .stars { animation: none; }
}

[data-motion="reduced"] .fan-card { transition: none; }
[data-motion="reduced"] .fan.on .fan-card.center { animation: none; }
[data-motion="reduced"] .stars { animation: none; }

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

.recommend {
  font-size: 0.625rem;
  font-weight: var(--w-strong);
  color: var(--on-gold);
  background: var(--gold);
  border-radius: var(--radius-pill);
  padding: 2px 8px;
  flex-shrink: 0;
}

/* 今日小目标 */
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

.streak-meta {
  font-size: 0.75rem;
  color: var(--dim);
  text-align: center;
  margin-bottom: var(--sp-3);
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
