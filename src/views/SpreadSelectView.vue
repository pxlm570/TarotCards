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

// ---- 牌阵选择指引（v1.5 追加）：按使用情境分组，数据来自 spreads.json 的 guide 字段 ----
const guideOpen = ref(false)

const GUIDE_GROUPS = [
  { title: '日常与状态', ids: ['single', 'time-flow', 'holy-trinity'] },
  { title: '事件与抉择', ids: ['two-choice', 'celtic-cross'] },
  { title: '周期与仪式', ids: ['new-moon', 'full-moon', 'birthday', 'spring-equinox', 'summer-solstice', 'autumn-equinox', 'winter-solstice'] }
]
const guideGroups = computed(() =>
  GUIDE_GROUPS.map((g) => ({
    title: g.title,
    items: g.ids.map((id) => spreads.find((s) => s.id === id)).filter(Boolean)
  }))
)
</script>

<template>
  <div class="spread-page">
    <!-- 与动线五页同款纯图标返回；reset=false：逛牌阵不作废首页那局进行中的占卜 -->
    <FlowExit :confirm="false" :reset="false" label="返回首页" />

    <header class="head">
      <h1 class="title">选择牌阵</h1>
      <p class="subtitle">牌阵把问题拆成几个角度，从一张的轻问到十张的深看</p>
      <button class="guide-entry" @click="guideOpen = true; tap()">
        <AppIcon name="star" :size="14" />
        怎么选牌阵？
      </button>
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

    <!-- 牌阵选择指引：底部弹层（v1.5 追加，数据源 spreads.json 的 guide 字段） -->
    <div v-if="guideOpen" class="sheet-mask" @click.self="guideOpen = false">
      <div class="sheet card guide-sheet">
        <p class="sheet-title">牌阵怎么选</p>
        <p class="guide-intro">先想清楚问题，再挑牌阵--问题越具体，牌答得越准。想不好怎么问？参考四条：</p>
        <div class="ask-chips">
          <span class="chip">问得开放</span>
          <span class="chip">聚焦自己</span>
          <span class="chip">拿回主动</span>
          <span class="chip">聚焦当下</span>
        </div>
        <p class="guide-eg">✗「我能拿到 offer 吗」　✓「我可以为求职做什么」</p>

        <section v-for="g in guideGroups" :key="g.title" class="guide-group">
          <h3 class="guide-group-title">{{ g.title }}</h3>
          <div v-for="s in g.items" :key="s.id" class="guide-item">
            <p class="gi-head">
              {{ s.name }}
              <span class="gi-meta">{{ s.cardCount }} 张 · {{ s.difficulty }}</span>
            </p>
            <p class="gi-fit">{{ s.guide.fit }}</p>
            <p class="gi-sub">适合：{{ s.guide.who }}</p>
            <p class="gi-sub gi-tip">{{ s.guide.tip }}</p>
          </div>
        </section>

        <p class="guide-note">「自由摆放」与「我的牌阵」：当你已有明确的问题拆解思路，随心摆就好。</p>
        <div class="guide-cautions">
          <p>· 是否题往往源于焦虑，试着换成「这件事的支持与阻力各是什么」</p>
          <p>· 时间类问题没有标准答案，改问「事成之前需要先发生什么」</p>
          <p>· 同一问题反复抽不会带来新信息，换个问法再问</p>
        </div>
        <button class="btn-solid btn-block guide-close" @click="guideOpen = false">明白了</button>
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

/* ---- 牌阵选择指引 ---- */
.guide-entry {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 12px;
  padding: 6px 14px;
  font-size: var(--fs-note);
  color: var(--gold-text);
  background: none;
  border: 1px solid var(--gold-deep);
  border-radius: var(--radius-pill);
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
}

.guide-sheet {
  max-height: 80vh;
  overflow-y: auto;
}

.guide-intro {
  font-size: var(--fs-note);
  color: var(--dim);
  line-height: 1.7;
  margin-bottom: 10px;
}

.ask-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.guide-eg {
  font-size: var(--fs-note);
  color: var(--dim);
  margin-bottom: 14px;
}

.guide-group {
  margin-bottom: 14px;
}

.guide-group-title {
  font-size: var(--fs-note);
  color: var(--dim);
  font-weight: var(--w-strong);
  letter-spacing: 0.12em;
  margin-bottom: 8px;
}

.guide-item {
  padding: 10px 0;
  border-top: 1px solid var(--line);
}

.gi-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: var(--fs-body);
  font-weight: var(--w-title);
}

.gi-meta {
  font-size: 0.6875rem;
  font-weight: var(--w-medium);
  color: var(--dim);
}

.gi-fit {
  margin-top: 4px;
  font-size: var(--fs-note);
  line-height: 1.6;
}

.gi-sub {
  margin-top: 3px;
  font-size: 0.75rem;
  color: var(--dim);
  line-height: 1.6;
}

.gi-tip {
  color: var(--ink);
  opacity: 0.75;
}

.guide-note {
  font-size: 0.75rem;
  color: var(--dim);
  line-height: 1.6;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

.guide-cautions {
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--sunk);
  border-radius: var(--radius-sm);
}

.guide-cautions p {
  font-size: 0.75rem;
  color: var(--dim);
  line-height: 1.7;
}

.guide-close {
  margin-top: 14px;
}
</style>
