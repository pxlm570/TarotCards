<script setup>
// 选牌阵独立页（Task 21）：从首页搬移的牌阵列表，整页空间放大卡片。
// 今日限定（新月/满月/生日窗口）置顶金标；新手/进阶分组；点选进提问页，动线零改动。
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import FlowExit from '../components/FlowExit.vue'
import { useReadingStore } from '../stores/reading.js'
import { useRitualToday } from '../composables/use-ritual-today.js'
import { tap } from '../lib/feedback.js'

const router = useRouter()
const reading = useReadingStore()
// 冷启动直接落在本页（深链 / PWA 恢复 / 本页刷新）时 store 还没水合，phase 会恒读到 idle，
// 点牌阵就会不弹确认、静默作废进行中的一局——先从 sessionStorage 恢复（同 HomeView）
reading.hasActiveReading()
const { ritualToday, ritualSpread, spreads } = useRitualToday()

// 新手/进阶分组：今日限定已单独置顶一节，这里剔除，避免同一张牌阵出现两次
const restSpreads = computed(() => spreads.filter((s) => s.id !== ritualToday.value))
const rookieSpreads = computed(() => restSpreads.value.filter((s) => s.difficulty === '新手'))
const advancedSpreads = computed(() => restSpreads.value.filter((s) => s.difficulty === '进阶'))

const ritualIcon = computed(() => {
  if (ritualToday.value === 'birthday') return 'star'
  if (ritualToday.value?.endsWith('-equinox') || ritualToday.value?.endsWith('-solstice')) return 'sun'
  return 'moon'
})

function startReading(spreadId) {
  if (reading.phase !== 'idle' && !window.confirm('有一局占卜正在进行，开始新的将丢弃它。确定吗？')) {
    return
  }
  tap()
  reading.reset()
  router.push({ path: '/reading/question', query: { spread: spreadId } })
}
</script>

<template>
  <div class="spread-page">
    <!-- 与动线五页同款纯图标返回；reset=false：逛牌阵不作废首页那局进行中的占卜 -->
    <FlowExit :confirm="false" :reset="false" label="返回首页" />

    <header class="head">
      <h1 class="title">选择牌阵</h1>
      <p class="subtitle">牌阵把问题拆成几个角度，从一张的轻问到十张的深看</p>
    </header>

    <!-- 今日限定置顶（新月/满月/生日窗口） -->
    <section v-if="ritualSpread" class="group">
      <h2 class="group-title">
        <AppIcon :name="ritualIcon" :size="14" />
        今日限定
      </h2>
      <button class="spread-card ritual card-press" @click="startReading(ritualSpread.id)">
        <span class="spread-n">
          {{ ritualSpread.cardCount }}
          <small>张</small>
        </span>
        <span class="spread-info">
          <span class="spread-name">{{ ritualSpread.name }}</span>
          <span class="spread-desc">{{ ritualSpread.positions.map((p) => p.label).join(' · ') }}</span>
        </span>
        <span class="recommend">今日限定</span>
      </button>
    </section>

    <section class="group">
      <h2 class="group-title">新手</h2>
      <button
        v-for="(spread, i) in rookieSpreads"
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
        <span v-if="i === 0" class="recommend">推荐</span>
      </button>
    </section>

    <section class="group">
      <h2 class="group-title">进阶</h2>
      <button
        v-for="(spread, i) in advancedSpreads"
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
      </button>
    </section>
  </div>
</template>

<style scoped>
.spread-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 24px 20px calc(40px + env(safe-area-inset-bottom, 0px));
}

.head {
  margin-bottom: var(--sp-3);
}

.title {
  font-size: var(--fs-title);
}

.subtitle {
  margin-top: 6px;
  color: var(--dim);
  font-size: var(--fs-note);
  line-height: 1.7;
}

.group {
  margin-bottom: var(--sp-4);
}

.group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-note);
  color: var(--dim);
  font-weight: var(--w-strong);
  letter-spacing: 0.12em;
  margin-bottom: 10px;
}

/* 整页空间：比首页列表更大的牌阵卡 */
.spread-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 16px;
  margin-bottom: 12px;
}

.spread-n {
  min-width: 52px;
  text-align: center;
  font-size: 2rem;
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
  gap: 4px;
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

/* 今日限定：金框金底置顶 */
.spread-card.ritual {
  border-color: var(--gold-deep);
  background: var(--gold-soft);
}

.recommend {
  font-size: 0.625rem;
  font-weight: var(--w-strong);
  color: var(--on-gold);
  background: var(--gold);
  border-radius: var(--radius-pill);
  padding: 3px 10px;
  flex-shrink: 0;
}
</style>
