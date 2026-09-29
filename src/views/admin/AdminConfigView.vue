<script setup>
// 站长 AI 服务配置页（2026-09-28 从 AiView 站长卡迁入 admin 区，独立链接 /admin/config）：
// GET /api/ai/config 拿脱敏配置，POST 白名单合并保存；api_key 留空=不变；
// 保存后最迟 60 秒生效（服务端进程内缓存）。门禁在服务端，非站长拿到 403 空态。
import { computed, onMounted, ref } from 'vue'
import PasswordField from '../../components/PasswordField.vue'
import { adminFetch } from '../../lib/admin-fetch.js'
import { toast } from '../../lib/feedback.js'

const state = ref('loading') // loading | denied | error | ready
const adminConfig = ref(null)
const adminForm = ref({ api_key: '' })
const adminMissing = ref([])
const adminSaving = ref(false)
const adminUpdatedAt = computed(() =>
  adminConfig.value?.updated_at ? new Date(adminConfig.value.updated_at).toLocaleString('zh-CN') : ''
)

// 数字字段以 Number 提交（坑：Number('')===0 会把档位悄悄写成 0，空串一律不提交）
const ADMIN_NUMBER_FIELDS = [
  'daily_standard_limit',
  'daily_deep_limit',
  'max_tokens_standard',
  'max_tokens_deep',
  'price_standard_in',
  'price_standard_out',
  'price_deep_in',
  'price_deep_out'
]

async function load() {
  state.value = 'loading'
  const { status, body } = await adminFetch('/api/ai/config')
  if (status === 200) {
    adminConfig.value = body.config
    adminMissing.value = body.missing || []
    adminForm.value = { ...body.config, api_key: '' }
    state.value = 'ready'
  } else if (status === 401 || status === 403 || status === 503) {
    state.value = 'denied'
  } else {
    state.value = 'error'
  }
}

onMounted(load)

async function save() {
  adminSaving.value = true
  try {
    const patch = {}
    for (const [key, value] of Object.entries(adminForm.value)) {
      if (value === '') continue
      patch[key] = ADMIN_NUMBER_FIELDS.includes(key) ? Number(value) : value
    }
    const { status, body } = await adminFetch('/api/ai/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    })
    if (status === 200) {
      adminConfig.value = body.config
      adminMissing.value = body.missing || []
      adminForm.value = { ...body.config, api_key: '' }
      toast('配置已保存，最迟 60 秒生效', 'success')
    } else {
      toast(body.error || '保存失败', 'warn')
    }
  } catch {
    toast('保存失败，请检查网络', 'warn')
  } finally {
    adminSaving.value = false
  }
}
</script>

<template>
  <div v-if="state === 'loading'" class="adm-card adm-empty">正在读取配置…</div>
  <div v-else-if="state === 'denied'" class="adm-card adm-empty">仅站长可访问此页面。</div>
  <div v-else-if="state === 'error'" class="adm-card adm-empty">
    配置加载失败。
    <button class="btn-ghost" @click="load">重试</button>
  </div>

  <section v-else class="adm-card">
    <p class="adm-card-title">AI 服务配置 <span class="adm-note">统一供给所有成员的模型服务</span></p>
    <div class="adm-form" style="margin-top: 14px">
      <label class="adm-field">
        <span class="adm-note">模型服务地址（OpenAI 兼容根地址）</span>
        <input v-model="adminForm.base_url" class="field-input" type="url" />
      </label>
      <label class="adm-field">
        <span class="adm-note">API Key（留空 = 保持不变 · 当前 {{ adminConfig.api_key }}）</span>
        <PasswordField v-model="adminForm.api_key" autocomplete="off" placeholder="sk-…" />
      </label>
      <div class="adm-field-grid">
        <label class="adm-field">
          <span class="adm-note">普通档模型名</span>
          <input v-model="adminForm.model_standard" class="field-input" type="text" />
        </label>
        <label class="adm-field">
          <span class="adm-note">深度档模型名</span>
          <input v-model="adminForm.model_deep" class="field-input" type="text" />
        </label>
        <label class="adm-field">
          <span class="adm-note">普通档每人每天次数</span>
          <input v-model="adminForm.daily_standard_limit" class="field-input" type="number" min="1" step="1" />
        </label>
        <label class="adm-field">
          <span class="adm-note">深度档每人每天次数</span>
          <input v-model="adminForm.daily_deep_limit" class="field-input" type="number" min="1" step="1" />
        </label>
      </div>
      <details class="adm-advanced">
        <summary>高级参数（单档 tokens 上限与单价 ¥/百万 tokens）</summary>
        <div class="adm-field-grid">
          <label class="adm-field"><span class="adm-note">普通档 max_tokens</span><input v-model="adminForm.max_tokens_standard" class="field-input" type="number" min="1" /></label>
          <label class="adm-field"><span class="adm-note">深度档 max_tokens</span><input v-model="adminForm.max_tokens_deep" class="field-input" type="number" min="1" /></label>
          <label class="adm-field"><span class="adm-note">普通档输入价</span><input v-model="adminForm.price_standard_in" class="field-input" type="number" min="0" step="0.1" /></label>
          <label class="adm-field"><span class="adm-note">普通档输出价</span><input v-model="adminForm.price_standard_out" class="field-input" type="number" min="0" step="0.1" /></label>
          <label class="adm-field"><span class="adm-note">深度档输入价</span><input v-model="adminForm.price_deep_in" class="field-input" type="number" min="0" step="0.1" /></label>
          <label class="adm-field"><span class="adm-note">深度档输出价</span><input v-model="adminForm.price_deep_out" class="field-input" type="number" min="0" step="0.1" /></label>
        </div>
      </details>
      <p v-if="adminMissing.length" class="adm-note adm-warn">配置尚不完整（服务端会拒答）：{{ adminMissing.join('、') }}</p>
      <p v-if="adminUpdatedAt" class="adm-note">最近更新：{{ adminUpdatedAt }} · 保存后最迟 60 秒生效，无需重新部署</p>
      <button class="btn-solid btn-block" :class="{ 'is-loading': adminSaving }" :disabled="adminSaving" @click="save">保存配置</button>
    </div>
  </section>
</template>
