<script setup>
// 邀请码生成（2026-09-26）：站长 GUI 的共用块——门禁页自助首码与 AiView 站长卡复用。
// 服务端 /api/invite/create 只对 ADMIN_EMAIL 会话放行；组件本身不含任何权限逻辑，
// 普通用户调用只会拿到 403，因此也永远不会出现在他们的界面上。
// 样式只用基类（segment/btn-ghost/btn-block），2026-09-28 与主站设计语言对齐。
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { toast } from '../lib/feedback.js'

const DAY_OPTIONS = [7, 14, 30, 90]
const days = ref(14)
const code = ref('')
const busy = ref(false)

async function generate() {
  busy.value = true
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      toast('请先登录', 'warn')
      return
    }
    const res = await fetch('/api/invite/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ days: Number(days.value) || 14 })
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast(body.error || '生成失败', 'warn')
      return
    }
    code.value = body.code
    toast(`邀请码已生成，${body.days} 天内有效，只显示这一次`, 'success')
  } catch {
    toast('生成失败，请检查网络', 'warn')
  } finally {
    busy.value = false
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(code.value)
    toast('已复制', 'success')
  } catch {
    toast('复制失败，请手动长按复制', 'warn')
  }
}
</script>

<template>
  <div class="invite-gen">
    <div class="gen-head">
      <span class="gen-title">站长通道 · 生成邀请码</span>
      <span class="gen-note">一人一码，只显示一次</span>
    </div>
    <div class="segment" role="radiogroup" aria-label="有效天数">
      <button
        v-for="option in DAY_OPTIONS"
        :key="option"
        type="button"
        :class="{ on: days === option }"
        @click="days = option"
      >
        {{ option }}天
      </button>
    </div>
    <button class="btn-ghost btn-block" :disabled="busy" @click="generate">{{ busy ? '生成中…' : '生成邀请码' }}</button>
    <template v-if="code">
      <div class="invite-result">
        <span class="invite-code">{{ code }}</span>
        <button class="btn-ghost" @click="copyCode">复制</button>
      </div>
      <p class="gen-note">请立即复制保存，此码不会再次显示。</p>
    </template>
  </div>
</template>

<style scoped>
.invite-gen { display: grid; gap: 10px; }
.gen-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.gen-title { color: var(--ink); font-weight: var(--w-strong); font-size: .875rem; }
.gen-note { color: var(--dim); font-size: var(--fs-note); }
.invite-result { display: flex; align-items: stretch; gap: 8px; }
.invite-code {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border: 2px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--ink);
  font-size: 1.125rem;
  font-weight: var(--w-strong);
  letter-spacing: .18em;
  text-transform: uppercase;
}
</style>
