<script setup>
// 选牌阵独立页（Task 21）：从首页搬移的牌阵列表，整页空间放大卡片。
// 今日限定（新月/满月/生日窗口）置顶金标；新手/进阶分组；点选进提问页，动线零改动。
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import FlowExit from '../components/FlowExit.vue'
import { useReadingStore } from '../stores/reading.js'
import { useRitualToday } from '../composables/use-ritual-today.js'
import { listCustomSpreads, deleteCustomSpread } from '../lib/custom-spreads.js'
import { tap, toast } from '../lib/feedback.js'

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

// ---- 我的牌阵（v1.5 Task 5/6）：本机自定义，占卜/编辑/删除 ----
const customSpreads = ref(listCustomSpreads())

function goEditor(id) {
  tap()
  router.push({ path: '/spread-editor', query: id ? { id } : undefined })
}

function removeCustom(spread) {
  const inUse = reading.spreadId === spread.id && reading.phase !== 'idle'
  const msg = inUse
    ? `删除「${spread.name}」？有一局用它进行的占卜还在进行，删除后那一局将无法继续。`
    : `删除「${spread.name}」？`
  if (!window.confirm(msg)) return
  deleteCustomSpread(spread.id)
  customSpreads.value = listCustomSpreads()
  toast('已删除')
}

// ---- 自由摆放（v1.5 Task 7）：选张数 -> 提问 -> 翻牌后拖位，摆法可存为我的牌阵 ----
const freePicking = ref(false)

function startFree(n) {
  freePicking.value = false
  if (reading.phase !== 'idle' && !window.confirm('有一局占卜正在进行，开始新的将丢弃它。确定吗？')) {
    return
  }
  tap()
  reading.reset()
  reading.selectFreeSpread(n)
  router.push({ path: '/reading/question', query: { spread: 'free' } })
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

    <!-- 我的牌阵（v1.5）：自由摆放模式 + 本机自定义；卡上带编辑/删除小操作，外层不能再用 button -->
    <section class="group">
      <h2 class="group-title">我的牌阵</h2>
      <button class="free-card card-press" @click="freePicking = true">
        <span class="spread-info">
          <span class="spread-name">自由摆放</span>
          <span class="spread-desc">翻牌后随心拖位，摆法可存为我的牌阵</span>
        </span>
        <AppIcon name="drag" :size="18" />
      </button>
      <div
        v-for="spread in customSpreads"
        :key="spread.id"
        class="spread-card custom-card card-press"
        role="button"
        tabindex="0"
        @click="startReading(spread.id)"
        @keydown.enter="startReading(spread.id)"
      >
        <span class="spread-n">
          {{ spread.cardCount }}
          <small>张</small>
        </span>
        <span class="spread-info">
          <span class="spread-name">{{ spread.name }}</span>
          <span class="spread-desc">{{ spread.positions.map((p) => p.label).join(' · ') }}</span>
        </span>
        <span class="mini-ops">
          <button class="mini-btn" :aria-label="`编辑${spread.name}`" @click.stop="goEditor(spread.id)">
            <AppIcon name="pen" :size="15" />
          </button>
          <button class="mini-btn" :aria-label="`删除${spread.name}`" @click.stop="removeCustom(spread)">
            <AppIcon name="x" :size="15" />
          </button>
        </span>
      </div>
      <button class="new-spread card-press" @click="goEditor()">
        <AppIcon name="pen" :size="16" />
        {{ customSpreads.length ? '再建一个' : '新建自定义牌阵' }}
      </button>
    </section>

    <!-- 自由摆放：选张数轻面板 -->
    <div v-if="freePicking" class="sheet-mask" @click.self="freePicking = false">
      <div class="sheet card">
        <p class="sheet-title">自由摆放，抽几张？</p>
        <div class="count-row">
          <button v-for="n in 10" :key="n" class="chip count-chip" @click="startFree(n)">{{ n }}</button>
        </div>
      </div>
    </div>
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

/* 我的牌阵：外层是 div[role=button]（卡上嵌着编辑/删除真按钮），补回 card 底色 */
.custom-card {
  cursor: pointer;
}

.mini-ops {
  display: inline-flex;
  gap: 4px;
  flex-shrink: 0;
}

.mini-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 6px;
  color: var(--dim);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
  transition: color var(--t-fast);
}

.mini-btn:active {
  color: var(--ink);
}

.new-spread {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 14px;
  font-size: var(--fs-note);
  color: var(--dim);
  border: 1px dashed var(--line);
  border-radius: var(--radius);
  background: none;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
}

/* 自由摆放模式入口：虚线框与新建入口同语言，但通栏更醒目 */
.free-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 16px;
  margin-bottom: 12px;
  border: 1px dashed var(--gold-deep);
  color: var(--dim);
  background: none;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
}

.free-card .spread-name {
  color: var(--ink);
}

.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(6, 10, 22, 0.45);
}

.sheet {
  width: 100%;
  max-width: 420px;
  padding: 20px 18px calc(20px + env(safe-area-inset-bottom, 0px));
  border-radius: var(--radius) var(--radius) 0 0;
}

.sheet-title {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  margin-bottom: 14px;
}

.count-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.count-chip {
  min-width: 44px;
  min-height: 44px;
  padding: 10px 14px;
  font-size: 1rem;
  font-weight: var(--w-strong);
}
</style>
