<script setup>
// 站长数据看板（2026-09-26）：成员/邀请码/AI 用量与成本/日活一屏总览。
// 数据全部来自 /api/admin/stats（服务端 owner 门禁）——本页不含权限逻辑，
// 非站长打开只会拿到 403，显示「仅站长可访问」空态。
import { computed, onMounted, ref } from 'vue'
import PageHead from '../components/PageHead.vue'
import { supabase } from '../lib/supabase.js'

const state = ref('loading') // loading | denied | error | ready
const data = ref(null)

async function load() {
  state.value = 'loading'
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (!token) {
      state.value = 'denied'
      return
    }
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    if (res.status === 403 || res.status === 503) {
      state.value = 'denied'
      return
    }
    if (!res.ok) {
      state.value = 'error'
      return
    }
    data.value = await res.json()
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}

onMounted(load)

const totals = computed(() => data.value?.totals || {})
const series = computed(() => data.value?.series || [])
const maxAi = computed(() => Math.max(1, ...series.value.map((d) => d.aiCalls)))
const maxDau = computed(() => Math.max(1, ...series.value.map((d) => d.dau)))

const FEATURE_LABEL = {
  reading_complete: '完成占卜',
  daily_draw: '每日一抽',
  lesson_complete: '完成课程',
  practice_complete: '完成练习',
  share_card: '生成分享卡'
}
const STATUS_LABEL = { redeemed: '已兑换', available: '未使用', expired: '已过期' }

function fmtDay(d) {
  return d ? String(d).slice(5) : ''
}
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
</script>

<template>
  <div class="page admin-view">
    <PageHead title="数据看板" back-to="/profile/ai" back-label="AI 解读" sub="成员、邀请码、AI 用量与活跃度 · 仅站长可见" />

    <div v-if="state === 'loading'" class="empty card">正在读取看板数据…</div>
    <div v-else-if="state === 'denied'" class="empty card">仅站长可访问此页面。</div>
    <div v-else-if="state === 'error'" class="empty card">
      看板加载失败。
      <button class="btn-ghost" @click="load">重试</button>
    </div>

    <template v-else>
      <section class="stat-grid">
        <div class="card stat-card"><span class="stat-num">{{ totals.members }}</span><span class="stat-label">成员数</span></div>
        <div class="card stat-card"><span class="stat-num">{{ totals.dauToday }}</span><span class="stat-label">今日活跃</span></div>
        <div class="card stat-card"><span class="stat-num">{{ totals.aiCallsToday }}</span><span class="stat-label">今日 AI 调用</span></div>
        <div class="card stat-card"><span class="stat-num">{{ fmtCny(totals.cost30dCny) }}</span><span class="stat-label">近 30 天 AI 成本</span></div>
      </section>

      <section class="card block">
        <p class="section-title">近 14 天趋势 <span class="legend"><i class="dot ai" />AI 调用<i class="dot dau" />活跃</span></p>
        <div class="trend">
          <div v-for="d in series" :key="d.day" class="trend-row">
            <span class="trend-day">{{ fmtDay(d.day) }}</span>
            <div class="trend-bars">
              <div class="bar-track"><div class="bar ai" :style="{ width: `${(d.aiCalls / maxAi) * 100}%` }" /></div>
              <div class="bar-track"><div class="bar dau" :style="{ width: `${(d.dau / maxDau) * 100}%` }" /></div>
            </div>
            <span class="trend-nums">{{ d.aiCalls }} / {{ d.dau }}</span>
          </div>
        </div>
      </section>

      <section class="card block">
        <p class="section-title">功能使用（统计期内次数）</p>
        <div v-if="(data.features || []).length" class="feature-chips">
          <span v-for="f in data.features" :key="f.name" class="chip">{{ fmtFeature(f.name) }} · {{ f.count }}</span>
        </div>
        <p v-else class="dim-line">暂无功能使用记录。</p>
      </section>

      <section class="card block">
        <p class="section-title">成员（{{ totals.members }}）</p>
        <div class="sheet">
          <table>
            <thead><tr><th>邮箱</th><th>加入</th><th>今日 普/深</th><th>累计调用</th><th>累计成本</th></tr></thead>
            <tbody>
              <tr v-for="m in data.members" :key="m.email">
                <td class="cell-email">{{ m.email }}</td>
                <td>{{ fmtTime(m.joinedAt) }}</td>
                <td>{{ m.todayStandard }}/{{ m.todayDeep }}</td>
                <td>{{ m.totalCalls }}</td>
                <td>{{ fmtCny(m.costCny) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card block">
        <p class="section-title">
          邀请码（未用 {{ totals.invites?.available }} · 已兑换 {{ totals.invites?.redeemed }} · 过期 {{ totals.invites?.expired }}）
        </p>
        <div class="sheet">
          <table>
            <thead><tr><th>标识</th><th>状态</th><th>兑换人</th><th>创建</th><th>有效期至</th></tr></thead>
            <tbody>
              <tr v-for="i in data.invites" :key="i.tail + i.createdAt">
                <td><code class="code-tail">{{ i.tail }}</code></td>
                <td><span class="status" :class="i.status">{{ STATUS_LABEL[i.status] }}</span></td>
                <td class="cell-email">{{ i.redeemedEmail || '—' }}</td>
                <td>{{ fmtTime(i.createdAt) }}</td>
                <td>{{ fmtTime(i.expiresAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.admin-view { padding: var(--sp-3) 20px var(--sp-4); display: grid; gap: 12px; }
.empty { padding: 32px 16px; text-align: center; color: var(--dim); display: grid; gap: 12px; justify-items: center; }
.stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.stat-card { padding: 14px; display: grid; gap: 4px; }
.stat-num { font-size: 1.45rem; font-weight: 700; color: var(--ink); }
.stat-label { color: var(--dim); font-size: var(--fs-note); }
.section-title { font-weight: 600; color: var(--ink); display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.legend { display: inline-flex; align-items: center; gap: 6px; color: var(--dim); font-size: var(--fs-note); font-weight: 400; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 2px; }
.dot.ai { background: var(--gold-deep); }
.dot.dau { background: var(--dim); }
.trend { display: grid; gap: 6px; margin-top: 10px; }
.trend-row { display: grid; grid-template-columns: 42px 1fr 44px; align-items: center; gap: 8px; }
.trend-day { color: var(--dim); font-size: var(--fs-note); }
.trend-bars { display: grid; gap: 3px; }
.bar-track { height: 6px; border-radius: 3px; background: var(--bg); overflow: hidden; }
.bar { height: 100%; border-radius: 3px; min-width: 0; }
.bar.ai { background: var(--gold-deep); }
.bar.dau { background: var(--dim); }
.trend-nums { color: var(--dim); font-size: var(--fs-note); text-align: right; }
.feature-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.dim-line { color: var(--dim); font-size: var(--fs-note); margin-top: 8px; }
.sheet { overflow-x: auto; margin-top: 10px; }
.sheet table { width: 100%; min-width: 460px; border-collapse: collapse; font-size: var(--fs-note); }
.sheet th { text-align: left; color: var(--dim); font-weight: 500; padding: 6px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
.sheet td { padding: 7px 8px; border-bottom: 1px solid var(--line); color: var(--ink); white-space: nowrap; }
.cell-email { max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
.code-tail { letter-spacing: .06em; color: var(--dim); }
.status { font-size: var(--fs-note); }
.status.redeemed { color: var(--gold-deep); }
.status.available { color: var(--ink); }
.status.expired { color: var(--dim); }
</style>
