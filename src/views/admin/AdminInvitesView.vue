<script setup>
// 邀请码管理页（2026-09-28 独立链接 /admin/invites）：生成（共用 InviteGenerator）
// + 全量码表（三态/长期标识/兑换人）。数据复用 /api/admin/stats（服务端 owner 门禁）。
import { computed, onMounted, ref } from 'vue'
import InviteGenerator from '../../components/InviteGenerator.vue'
import { adminFetch } from '../../lib/admin-fetch.js'

const state = ref('loading') // loading | denied | error | ready
const data = ref(null)

async function load() {
  state.value = 'loading'
  const { status, body } = await adminFetch('/api/admin/stats')
  if (status === 200) {
    data.value = body
    state.value = 'ready'
  } else if (status === 401 || status === 403 || status === 503) {
    state.value = 'denied'
  } else {
    state.value = 'error'
  }
}

onMounted(load)

const invites = computed(() => data.value?.invites || [])
const totals = computed(() => data.value?.totals?.invites || {})

const STATUS_LABEL = { redeemed: '已兑换', available: '未使用', expired: '已过期' }

function fmtTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div v-if="state === 'loading'" class="adm-card adm-empty">正在读取邀请码…</div>
  <div v-else-if="state === 'denied'" class="adm-card adm-empty">仅站长可访问此页面。</div>
  <div v-else-if="state === 'error'" class="adm-card adm-empty">
    邀请码加载失败。
    <button class="btn-ghost" @click="load">重试</button>
  </div>

  <template v-else>
    <section class="adm-card">
      <!-- 组件自带「站长通道 · 生成邀请码」标题，卡片不再重复 -->
      <InviteGenerator />
    </section>

    <section class="adm-card">
      <p class="adm-card-title">
        全部邀请码（未用 {{ totals.available }} · 已兑换 {{ totals.redeemed }} · 过期 {{ totals.expired }}）
      </p>
      <div class="adm-sheet" style="margin-top: 10px">
        <table>
          <thead><tr><th>标识</th><th>状态</th><th>兑换人</th><th>创建</th><th>有效期至</th></tr></thead>
          <tbody>
            <tr v-for="i in invites" :key="i.tail + i.createdAt">
              <td><code class="adm-code-tail">{{ i.tail }}</code></td>
              <td><span class="adm-status" :class="i.status">{{ STATUS_LABEL[i.status] }}</span></td>
              <td class="adm-cell-email">{{ i.redeemedEmail || '—' }}</td>
              <td>{{ fmtTime(i.createdAt) }}</td>
              <td>{{ i.longTerm ? '长期有效' : fmtTime(i.expiresAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>
