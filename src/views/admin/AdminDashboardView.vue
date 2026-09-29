<script setup>
// 数据看板（2026-09-28 照 Sakai 版式重做）：KPI 卡行 → 图表区（14 天普/深堆叠柱、
// 功能使用榜、14 天日活、30 天成本）→ 成员表。数据全部来自 /api/admin/stats
// （服务端 owner 门禁）；非站长打开只会拿到 403 空态。图表用 Chart.js，
// 动态 import 只进 /admin 的懒加载 chunk，不占主包。
import { computed, onBeforeUnmount, onMounted, ref, nextTick } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '../../components/AppIcon.vue'
import { adminFetch } from '../../lib/admin-fetch.js'

const state = ref('loading') // loading | denied | error | ready
const data = ref(null)

async function load() {
  state.value = 'loading'
  const { status, body } = await adminFetch('/api/admin/stats')
  if (status === 200) {
    data.value = body
    state.value = 'ready'
    await nextTick()
    renderCharts()
  } else if (status === 401 || status === 403 || status === 503) {
    state.value = 'denied'
  } else {
    state.value = 'error'
  }
}

onMounted(load)

const totals = computed(() => data.value?.totals || {})
const series = computed(() => data.value?.series || [])
const cost30 = computed(() => data.value?.cost30 || [])
const features = computed(() => data.value?.features || [])
const maxFeature = computed(() => Math.max(1, ...features.value.map((f) => f.count)))
const dauYesterday = computed(() => {
  const s = series.value
  return s.length >= 2 ? s[s.length - 2].dau : null
})

const FEATURE_LABEL = {
  reading_complete: '完成占卜',
  daily_draw: '每日一抽',
  lesson_complete: '完成课程',
  practice_complete: '完成练习',
  share_card: '生成分享卡'
}
const STATUS_LABEL = { redeemed: '已兑换', available: '未使用', expired: '已过期' }

function fmtTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtCny(n) {
  return `¥${(Math.round((n || 0) * 100) / 100).toFixed(2)}`
}
function fmtFeature(name) {
  return FEATURE_LABEL[name] || name
}
function fmtDayShort(d) {
  return d ? String(d).slice(5) : ''
}
function cssVar(name, fallback) {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

// —— Chart.js（懒加载，离开页面即销毁）——
let charts = []
function destroyCharts() {
  for (const c of charts) c.destroy()
  charts = []
}
onBeforeUnmount(destroyCharts)

function baseScales(stackedX) {
  const line = cssVar('--line', '#e5e0d5')
  const dim = cssVar('--dim', '#8a8a8a')
  return {
    x: { stacked: stackedX, grid: { display: false }, ticks: { color: dim, font: { size: 10 } }, border: { color: line } },
    y: { stacked: stackedX, beginAtZero: true, ticks: { color: dim, precision: 0, font: { size: 10 } }, grid: { color: line }, border: { display: false } }
  }
}
function baseLegend() {
  return { labels: { color: cssVar('--dim', '#8a8a8a'), boxWidth: 10, boxHeight: 10, font: { size: 11 } } }
}

async function renderCharts() {
  destroyCharts()
  const callsCanvas = document.getElementById('adm-calls-chart')
  const dauCanvas = document.getElementById('adm-dau-chart')
  const costCanvas = document.getElementById('adm-cost-chart')
  if (!callsCanvas || !dauCanvas || !costCanvas) return
  try {
    const { default: Chart } = await import('chart.js/auto')
    const gold = cssVar('--gold-deep', '#b8860b')
    const goldSoft = cssVar('--gold', '#d4af37')
    const dim = cssVar('--dim', '#8a8a8a')
    const days = series.value.map((d) => fmtDayShort(d.day))
    charts.push(
      new Chart(callsCanvas, {
        type: 'bar',
        data: {
          labels: days,
          datasets: [
            { label: '普通解读', data: series.value.map((d) => d.standard), backgroundColor: goldSoft, borderRadius: 3 },
            { label: '深度解读', data: series.value.map((d) => d.deep), backgroundColor: gold, borderRadius: 3 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: baseScales(true), plugins: { legend: baseLegend() } }
      }),
      new Chart(dauCanvas, {
        type: 'line',
        data: {
          labels: days,
          datasets: [
            { label: '日活', data: series.value.map((d) => d.dau), borderColor: gold, backgroundColor: `${gold}33`, fill: true, tension: 0.35, pointRadius: 2.5 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: baseScales(false), plugins: { legend: baseLegend() } }
      }),
      new Chart(costCanvas, {
        type: 'bar',
        data: {
          labels: cost30.value.map((d) => fmtDayShort(d.day)),
          datasets: [
            { label: '成本（元）', data: cost30.value.map((d) => d.costCny), backgroundColor: dim, borderRadius: 3 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: baseScales(false), plugins: { legend: baseLegend() } }
      })
    )
  } catch {
    // 图表库加载失败不挡看板：表格与 KPI 仍是完整信息
  }
}
</script>

<template>
  <div v-if="state === 'loading'" class="adm-card adm-empty">正在读取看板数据…</div>
  <div v-else-if="state === 'denied'" class="adm-card adm-empty">仅站长可访问此页面。</div>
  <div v-else-if="state === 'error'" class="adm-card adm-empty">
    看板加载失败。
    <button class="btn-ghost" @click="load">重试</button>
  </div>

  <template v-else>
    <!-- KPI 行（Sakai 式四卡） -->
    <section class="adm-kpis">
      <div class="adm-card adm-kpi">
        <span class="adm-kpi-icon"><AppIcon name="profile" :size="19" /></span>
        <div class="adm-kpi-body">
          <span class="adm-kpi-num">{{ totals.members }}</span>
          <span class="adm-kpi-label">成员数</span>
          <span class="adm-kpi-aux">注册账号 {{ totals.accounts }}</span>
        </div>
      </div>
      <div class="adm-card adm-kpi">
        <span class="adm-kpi-icon"><AppIcon name="sun" :size="19" /></span>
        <div class="adm-kpi-body">
          <span class="adm-kpi-num">{{ totals.dauToday }}</span>
          <span class="adm-kpi-label">今日活跃</span>
          <span class="adm-kpi-aux">昨日 {{ dauYesterday ?? '—' }}</span>
        </div>
      </div>
      <div class="adm-card adm-kpi">
        <span class="adm-kpi-icon"><AppIcon name="sparkle" :size="19" /></span>
        <div class="adm-kpi-body">
          <span class="adm-kpi-num">{{ totals.aiCallsToday }}</span>
          <span class="adm-kpi-label">今日 AI 调用</span>
          <span class="adm-kpi-aux">普通 {{ totals.aiCallsTodayStandard }} · 深度 {{ totals.aiCallsTodayDeep }}</span>
        </div>
      </div>
      <div class="adm-card adm-kpi">
        <span class="adm-kpi-icon"><AppIcon name="star" :size="19" /></span>
        <div class="adm-kpi-body">
          <span class="adm-kpi-num">{{ fmtCny(totals.cost30dCny) }}</span>
          <span class="adm-kpi-label">近 30 天成本</span>
          <span class="adm-kpi-aux">今日 {{ fmtCny(totals.costTodayCny) }}</span>
        </div>
      </div>
    </section>

    <!-- 图表行 1：14 天普/深堆叠柱 + 功能使用榜 -->
    <section class="adm-charts">
      <div class="adm-card adm-chart-wide">
        <p class="adm-card-title">近 14 天 AI 调用</p>
        <div class="adm-chart-box"><canvas id="adm-calls-chart" /></div>
      </div>
      <div class="adm-card">
        <p class="adm-card-title">功能使用榜</p>
        <div v-if="features.length" class="adm-features">
          <div v-for="f in features" :key="f.name" class="adm-feature">
            <span class="adm-feature-name">{{ fmtFeature(f.name) }}</span>
            <div class="adm-feature-track"><div class="adm-feature-bar" :style="{ width: `${(f.count / maxFeature) * 100}%` }" /></div>
            <span class="adm-feature-count">{{ f.count }}</span>
          </div>
        </div>
        <p v-else class="adm-note">暂无功能使用记录。</p>
      </div>
    </section>

    <!-- 图表行 2：日活 + 成本趋势 -->
    <section class="adm-charts adm-charts-half">
      <div class="adm-card">
        <p class="adm-card-title">近 14 天日活</p>
        <div class="adm-chart-box"><canvas id="adm-dau-chart" /></div>
      </div>
      <div class="adm-card">
        <p class="adm-card-title">近 30 天每日成本</p>
        <div class="adm-chart-box"><canvas id="adm-cost-chart" /></div>
      </div>
    </section>

    <!-- 邀请码概览行 -->
    <section class="adm-card adm-invite-strip">
      <span>邀请码：未用 {{ totals.invites?.available }} · 已兑换 {{ totals.invites?.redeemed }} · 过期 {{ totals.invites?.expired }}</span>
      <RouterLink class="adm-strip-link" to="/admin/invites">管理邀请码</RouterLink>
    </section>

    <!-- 成员表 -->
    <section class="adm-card">
      <p class="adm-card-title">成员（{{ totals.members }}）</p>
      <div class="adm-sheet" style="margin-top: 10px">
        <table>
          <thead><tr><th>邮箱</th><th>加入</th><th>今日 普/深</th><th>累计调用</th><th>累计成本</th></tr></thead>
          <tbody>
            <tr v-for="m in data.members" :key="m.email">
              <td class="adm-cell-email">{{ m.email }}</td>
              <td>{{ fmtTime(m.joinedAt) }}</td>
              <td>{{ m.todayStandard }}/{{ m.todayDeep }}</td>
              <td>{{ m.totalCalls }}</td>
              <td>{{ fmtCny(m.costCny) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>

<style scoped>
/* KPI 四卡（Sakai 式：图标片 + 数值 + 标签 + 辅助行） */
.adm-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.adm-kpi { display: flex; gap: 12px; align-items: center; padding: 16px; }
.adm-kpi-icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  color: var(--gold-text);
  background: var(--gold-soft);
}
.adm-kpi-body { display: grid; gap: 1px; min-width: 0; }
.adm-kpi-num { font-size: 1.45rem; font-weight: var(--w-strong); color: var(--ink); line-height: 1.15; }
.adm-kpi-label { color: var(--ink); font-size: .8125rem; font-weight: var(--w-medium); }
.adm-kpi-aux { color: var(--dim); font-size: .75rem; line-height: 1.4; }

/* 图表网格：宽图 + 榜单 / 两张半宽 */
.adm-charts { display: grid; grid-template-columns: 1.7fr 1fr; gap: 12px; }
.adm-charts-half { grid-template-columns: 1fr 1fr; }
.adm-chart-box { position: relative; height: 240px; margin-top: 10px; }
.adm-charts-half .adm-chart-box { height: 210px; }

/* 功能榜：横向进度条 */
.adm-features { display: grid; gap: 12px; margin-top: 14px; }
.adm-feature { display: grid; grid-template-columns: 70px 1fr 36px; align-items: center; gap: 8px; }
.adm-feature-name { color: var(--ink); font-size: var(--fs-note); }
.adm-feature-track { height: 8px; border-radius: 4px; background: var(--bg); overflow: hidden; }
.adm-feature-bar { height: 100%; border-radius: 4px; background: var(--gold-deep); }
.adm-feature-count { color: var(--dim); font-size: var(--fs-note); text-align: right; }

/* 邀请码概览条 */
.adm-invite-strip { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; color: var(--dim); font-size: var(--fs-note); }
.adm-strip-link { color: var(--gold-text); font-weight: var(--w-medium); }

@media (max-width: 860px) {
  .adm-kpis { grid-template-columns: repeat(2, 1fr); }
  .adm-charts, .adm-charts-half { grid-template-columns: 1fr; }
}
@media (max-width: 420px) {
  .adm-kpis { grid-template-columns: 1fr; }
  .adm-kpi-num { font-size: 1.3rem; }
}
</style>
