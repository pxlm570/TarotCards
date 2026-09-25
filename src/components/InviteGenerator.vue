<script setup>
// 邀请码生成（2026-09-26）：站长 GUI 的共用块——门禁页自助首码与 AiView 站长卡复用。
// 服务端 /api/invite/create 只对 ADMIN_EMAIL 会话放行；组件本身不含任何权限逻辑，
// 普通用户调用只会拿到 403，因此也永远不会出现在他们的界面上。
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { toast } from '../lib/feedback.js'

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
    <span class="field-label">生成邀请码（一人一码 · 只显示一次）</span>
    <div class="invite-row">
      <select v-model.number="days" class="field-input invite-days" aria-label="有效天数">
        <option :value="7">7 天</option>
        <option :value="14">14 天</option>
        <option :value="30">30 天</option>
        <option :value="90">90 天</option>
      </select>
      <button class="btn-ghost" :disabled="busy" @click="generate">{{ busy ? '生成中…' : '生成邀请码' }}</button>
    </div>
    <div v-if="code" class="invite-result">
      <code class="invite-code">{{ code }}</code>
      <button class="btn-ghost" @click="copyCode">复制</button>
    </div>
  </div>
</template>

<style scoped>
.invite-gen { display: grid; gap: 4px; }
.invite-row { display: flex; gap: 8px; margin-top: 4px; }
.invite-row .btn-ghost { flex: 1; }
.invite-days { width: 104px; flex: none; }
.invite-result { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.invite-code { flex: 1; padding: 10px; border: 1px dashed var(--gold-deep); border-radius: var(--radius-sm); color: var(--ink); font-size: 1rem; letter-spacing: .08em; text-align: center; }
</style>
