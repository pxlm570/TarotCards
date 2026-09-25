<script setup>
// AI 解读详情页：端点配置/人格/测试连接/分享链接（v1.5「我的」页收缩重构，从主页面迁入）。
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { loadSettings } from '../../lib/storage.js'
import { useSettingsStore } from '../../stores/settings.js'
import { streamChat } from '../../lib/ai-client.js'
import { renderSVG } from 'uqr'
import { useEscClose } from '../../composables/use-esc-close.js'
import { takePendingImport, discardPendingImport } from '../../lib/config-import.js'
import PageHead from '../../components/PageHead.vue'
import AppIcon from '../../components/AppIcon.vue'
import InviteGenerator from '../../components/InviteGenerator.vue'
import { toast } from '../../lib/feedback.js'
import { customAIAllowed, defaultAIEnabled, supabase } from '../../lib/supabase.js'

const route = useRoute()
const settingsStore = useSettingsStore()
const hasDefaultAI = defaultAIEnabled
const customEnabled = customAIAllowed
const testing = ref(false)
const aiInput = ref({ ...loadSettings() })
const shareLink = ref('') // 生成的配置分享链接（二维码弹层）
const qrSvg = computed(() => (shareLink.value ? renderSVG(shareLink.value) : ''))
useEscClose(() => (shareLink.value = '')) // Esc 关闭二维码弹层

// 分享配置两段式（评审 2026-09-03）：main.js 只解析暂存并带 ?import=1 跳转到这里，
// 由用户亲眼确认「应用/放弃」——不再静默写入，防伪造链接静默替换 AI 端点。
const pendingImport = ref(null)
onMounted(() => {
  loadAdminConfig()
  // 统一 LLM 部署（customEnabled=false）：自定义入口已下线，残留的 custom 模式
  // 与 #import 分享链一并作废，避免把用户导向一个不再生效的表单。
  if (!customEnabled) {
    if (aiInput.value.aiMode !== 'default') saveAI({ aiMode: 'default' })
    discardPendingImport()
    return
  }
  if (route.query.import === '1') pendingImport.value = takePendingImport()
})

// —— 站长配置（统一 LLM + 邀请码生成，2026-09-25 用户要求 GUI 化）——
// 门禁完全在服务端：/api/ai/config 对普通成员回 403、未配 ADMIN_EMAIL 回 503，
// 前端只「拿得到就渲染」，普通用户既看不到表单也拿不到任何配置数据。
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
const adminConfig = ref(null)
const adminForm = ref({ api_key: '' })
const adminMissing = ref([])
const adminSaving = ref(false)
const adminUpdatedAt = computed(() =>
  adminConfig.value?.updated_at ? new Date(adminConfig.value.updated_at).toLocaleString('zh-CN') : ''
)

async function adminToken() {
  if (!supabase) return ''
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

async function loadAdminConfig() {
  try {
    const token = await adminToken()
    if (!token) return
    const res = await fetch('/api/ai/config', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    if (!res.ok) return
    const body = await res.json()
    adminConfig.value = body.config
    adminMissing.value = body.missing || []
    adminForm.value = { ...body.config, api_key: '' }
  } catch {
    // 本地静态开发无 /api 后端：静默隐藏
  }
}

async function saveAdminConfig() {
  adminSaving.value = true
  try {
    const patch = {}
    for (const [key, value] of Object.entries(adminForm.value)) {
      if (key === 'api_key') {
        // 留空 = 保持现值（表单里只显示脱敏残影，不回填）
        if (typeof value === 'string' && value.trim()) patch.api_key = value.trim()
        continue
      }
      if (value === '' || value == null) continue
      patch[key] = ADMIN_NUMBER_FIELDS.includes(key) ? Number(value) : String(value).trim()
    }
    const token = await adminToken()
    const res = await fetch('/api/ai/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ patch })
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast(body.error || '保存失败', 'warn')
      return
    }
    adminConfig.value = body.config
    adminMissing.value = body.missing || []
    adminForm.value = { ...body.config, api_key: '' }
    toast('已保存，最迟 60 秒生效', 'success')
  } catch {
    toast('保存失败，请检查网络', 'warn')
  } finally {
    adminSaving.value = false
  }
}
function applyImport() {
  if (!pendingImport.value) return
  saveAI(pendingImport.value)
  pendingImport.value = null
  toast('已导入分享的 AI 配置', 'success')
}
function discardImport() {
  pendingImport.value = null // 暂存在进页时已被 takePendingImport 取走清掉
}

// 快捷填充：只帮填 baseUrl（不做官方端点绑定，其余常见端点自填 model/key）
const QUICK_ENDPOINTS = [
  { label: '小米 MiMo', baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com' },
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' }
]

function quickFill(endpoint) {
  saveAI({ baseUrl: endpoint.baseUrl })
  toast(`已填入 ${endpoint.label} 端点`)
}

function saveAI(patch) {
  const previousKey = aiInput.value.apiKey
  const writesCustomConfig = ['baseUrl', 'model', 'apiKey'].some((key) => Object.hasOwn(patch, key))
  const next = settingsStore.update({
    ...patch,
    ...(writesCustomConfig && !Object.hasOwn(patch, 'aiMode') ? { aiMode: 'custom' } : {})
  })
  Object.assign(aiInput.value, next)
  if (previousKey && !next.apiKey) toast('端点已更换，请填写该服务的 API key', 'info')
}

async function testConnection() {
  testing.value = true
  try {
    // for-await + break：让 generator 走完 finally 释放 reader/连接（.next() 丢弃 generator 会泄漏）。
    // 刻意不走 useStream：一次性探测、首块即断、生成器自带清理，接入流式状态机反而绕
    for await (const _d of streamChat({ messages: [{ role: 'user', content: 'ping' }], forceCustom: true })) break
    toast('连接正常', 'success')
  } catch (e) {
    toast(e.status === 401 ? '密钥无效' : e.status ? `失败（${e.status}）` : '连接失败，检查 baseUrl 或网络', 'info')
  } finally {
    testing.value = false
  }
}

function genShareLink() {
  const cfg = { baseUrl: aiInput.value.baseUrl, model: aiInput.value.model, apiKey: aiInput.value.apiKey }
  if (!cfg.baseUrl || !cfg.apiKey) {
    toast('请先填写 baseUrl 和 key 再生成')
    return
  }
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))))
  const link = `${location.origin}${import.meta.env.BASE_URL}#import=${b64}`
  shareLink.value = link
  try {
    navigator.clipboard.writeText(link)
    toast('链接已复制，扫码或转发给信任的人', 'success')
  } catch {
    toast('复制失败，可长按链接复制')
  }
}

function copyShareLink() {
  try {
    navigator.clipboard.writeText(shareLink.value)
    toast('已复制链接')
  } catch {
    toast('复制失败')
  }
}
</script>

<template>
  <div class="page ai-view">
    <PageHead
      title="AI 解读" back-to="/profile" back-label="我的"
      :sub="customEnabled ? '可使用星语提供的 AI，也可连接自己的模型服务。自定义 API key 只保存在当前浏览器。' : '由星语统一提供 AI 解读，无需自行配置。'"
    />

    <!-- 分享配置确认条：链接导入的第二段（第一段在 main.js 暂存）；自定义下线时不生效 -->
    <section v-if="pendingImport && customEnabled" class="card block import-banner">
      <p class="import-title">检测到分享的 AI 配置</p>
      <p class="import-meta">
        {{ pendingImport.baseUrl || '（未填端点）' }} · {{ pendingImport.model || '（未填模型）' }} ·
        {{ pendingImport.apiKey ? '含 API key' : '不含 key' }}
      </p>
      <p class="import-warn">只应用来源可信的配置；应用后你的提问会发送到该端点。</p>
      <p v-if="!pendingImport.apiKey" class="import-warn">若更换端点，原 API key 会清除，请填写新服务的密钥。</p>
      <div class="import-actions">
        <button class="btn-ghost" @click="discardImport">放弃</button>
        <button class="btn-solid" @click="applyImport">应用</button>
      </div>
    </section>

    <section class="card block">
      <div v-if="customEnabled" class="mode-picker">
        <p class="field-label">使用方式</p>
        <div class="chips">
          <button v-if="hasDefaultAI" class="chip" :class="{ on: aiInput.aiMode === 'default' }" @click="saveAI({ aiMode: 'default' })">星语提供</button>
          <button class="chip" :class="{ on: aiInput.aiMode === 'custom' }" @click="saveAI({ aiMode: 'custom' })">自定义 AI</button>
        </div>
        <p v-if="aiInput.aiMode === 'default'" class="mode-note">普通 AI 解读每日可用；深度解读每日限一次。AI 请求会发送给模型服务，并计入本项目体验额度。</p>
        <p v-else class="mode-note">填入你自己的模型端点、模型名称和 API key。请求由浏览器直接发送到该服务，费用由你的服务账户承担。</p>
      </div>
      <p v-else class="mode-note">星语统一提供 AI 解读：普通解读每日可用，深度解读每日限一次。AI 请求会发送给模型服务，并计入本项目体验额度。</p>

      <template v-if="customEnabled && aiInput.aiMode === 'custom'">
      <div class="quickfill">
        <span class="field-label">快捷填充（只填 baseUrl）</span>
        <div class="chips">
          <button
            v-for="ep in QUICK_ENDPOINTS"
            :key="ep.label"
            class="chip"
            :class="{ on: aiInput.baseUrl === ep.baseUrl }"
            @click="quickFill(ep)"
          >{{ ep.label }}</button>
        </div>
      </div>
      <label class="field">
        <span class="field-label">baseUrl</span>
        <input v-model="aiInput.baseUrl" class="field-input" type="url" placeholder="https://api.deepseek.com" @change="saveAI({ baseUrl: aiInput.baseUrl })" />
      </label>
      <label class="field">
        <span class="field-label">模型</span>
        <input v-model="aiInput.model" class="field-input" type="text" placeholder="deepseek-chat" @change="saveAI({ model: aiInput.model })" />
      </label>
      <label class="field">
        <span class="field-label">API key</span>
        <input v-model="aiInput.apiKey" class="field-input" type="password" placeholder="sk-…" @change="saveAI({ apiKey: aiInput.apiKey })" />
      </label>
      </template>

      <div class="persona">
        <button
          v-for="p in [['gentle', '温柔治愈'], ['direct', '直率犀利'], ['scholar', '学术严谨']]"
          :key="p[0]"
          class="chip"
          :class="{ on: aiInput.persona === p[0] }"
          @click="saveAI({ persona: p[0] })"
        >{{ p[1] }}</button>
      </div>
      <template v-if="customEnabled && aiInput.aiMode === 'custom'">
        <button class="btn-ghost btn-block" :class="{ 'is-loading': testing }" :disabled="testing" @click="testConnection">测试连接</button>
        <button class="btn-ghost btn-block" style="margin-top:8px" @click="genShareLink">生成配置分享链接（复制）</button>
      </template>
    </section>

    <!-- 站长配置：仅 ADMIN_EMAIL 账号可见（服务端门禁，普通用户既看不到表单也拿不到数据） -->
    <section v-if="adminConfig" class="card block admin-card">
      <p class="field-label">站长配置 · 统一 LLM 与邀请码（仅此账号可见）</p>
      <label class="field">
        <span class="field-label">模型服务地址（OpenAI 兼容根地址，填到 /v1 为止）</span>
        <input v-model="adminForm.base_url" class="field-input" type="url" />
      </label>
      <label class="field">
        <span class="field-label">API Key（留空 = 保持不变 · 当前 {{ adminConfig.api_key }}）</span>
        <input v-model="adminForm.api_key" class="field-input" type="password" autocomplete="off" placeholder="sk-…" />
      </label>
      <label class="field">
        <span class="field-label">普通档模型名</span>
        <input v-model="adminForm.model_standard" class="field-input" type="text" />
      </label>
      <label class="field">
        <span class="field-label">深度档模型名</span>
        <input v-model="adminForm.model_deep" class="field-input" type="text" />
      </label>
      <label class="field">
        <span class="field-label">普通档每人每天次数</span>
        <input v-model="adminForm.daily_standard_limit" class="field-input" type="number" min="1" step="1" />
      </label>
      <label class="field">
        <span class="field-label">深度档每人每天次数</span>
        <input v-model="adminForm.daily_deep_limit" class="field-input" type="number" min="1" step="1" />
      </label>
      <details class="admin-advanced">
        <summary>高级参数（单档 tokens 上限与单价 ¥/百万 tokens）</summary>
        <label class="field"><span class="field-label">普通档 max_tokens</span><input v-model="adminForm.max_tokens_standard" class="field-input" type="number" min="1" /></label>
        <label class="field"><span class="field-label">深度档 max_tokens</span><input v-model="adminForm.max_tokens_deep" class="field-input" type="number" min="1" /></label>
        <label class="field"><span class="field-label">普通档输入价</span><input v-model="adminForm.price_standard_in" class="field-input" type="number" min="0" step="0.1" /></label>
        <label class="field"><span class="field-label">普通档输出价</span><input v-model="adminForm.price_standard_out" class="field-input" type="number" min="0" step="0.1" /></label>
        <label class="field"><span class="field-label">深度档输入价</span><input v-model="adminForm.price_deep_in" class="field-input" type="number" min="0" step="0.1" /></label>
        <label class="field"><span class="field-label">深度档输出价</span><input v-model="adminForm.price_deep_out" class="field-input" type="number" min="0" step="0.1" /></label>
      </details>
      <p v-if="adminMissing.length" class="mode-note admin-warn">配置尚不完整（服务端会拒答）：{{ adminMissing.join('、') }}</p>
      <p v-if="adminUpdatedAt" class="mode-note">最近更新：{{ adminUpdatedAt }} · 保存后最迟 60 秒生效，无需重新部署</p>
      <button class="btn-solid btn-block" :class="{ 'is-loading': adminSaving }" :disabled="adminSaving" @click="saveAdminConfig">保存配置</button>

      <InviteGenerator />
    </section>

    <!-- 配置分享链接二维码弹层 -->
    <div v-if="shareLink" class="modal" @click.self="shareLink = ''">
      <div class="dialog card">
        <h3 class="dialog-title">配置分享</h3>
        <div class="qr" v-html="qrSvg" />
        <p class="dialog-link">{{ shareLink }}</p>
        <p class="dialog-warn">链接含你的 API key：扫码或转发即等同让对方持有 key，只发给信任的人。</p>
        <div class="dialog-actions">
          <button class="btn-ghost" @click="shareLink = ''">关闭</button>
          <button class="btn-solid" @click="copyShareLink"><AppIcon name="check" :size="15" /> 复制</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-view {
  padding: var(--sp-3) 20px var(--sp-4);
}

.block {
  padding: var(--sp-2);
}

.mode-picker { margin-bottom: 16px; }
.mode-picker .chips { display: flex; gap: 8px; margin-top: 7px; }
.mode-picker .chip { flex: 1; }
.mode-note { margin-top: 9px; color: var(--dim); font-size: var(--fs-note); line-height: 1.6; }

.admin-card { display: grid; gap: 10px; }
.admin-advanced summary { cursor: pointer; color: var(--dim); font-size: var(--fs-note); }
.admin-advanced .field { margin-top: 8px; }
.admin-warn { color: var(--coral); }

.field {
  display: block;
  margin-bottom: 10px;
}

.quickfill {
  margin-bottom: 12px;
}

.quickfill .chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.quickfill .chip {
  padding: 8px 14px;
  font-size: 0.8125rem;
}

.field-label {
  display: block;
  font-size: var(--fs-note);
  color: var(--dim);
  margin-bottom: 4px;
}

.field-input {
  width: 100%;
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  color: var(--ink);
  font-size: 1rem;
}

.field-input:focus {
  outline: none;
  border-color: var(--gold-deep);
}

.persona {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.persona .chip {
  flex: 1;
  padding: 8px 4px;
  font-size: 0.8125rem;
  text-align: center;
}

/* 二维码弹层 */
.modal {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 45;
  padding: 24px;
}

.dialog {
  width: 100%;
  max-width: 360px;
  padding: var(--sp-3);
  text-align: center;
}

.dialog-title {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  margin-bottom: 12px;
}

.qr {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.qr :deep(svg) {
  width: 168px;
  height: 168px;
}

.dialog-link {
  font-size: 0.6875rem;
  color: var(--dim);
  word-break: break-all;
  margin-bottom: 10px;
}

.dialog-warn {
  font-size: 0.75rem;
  color: var(--coral);
  line-height: 1.6;
  margin-bottom: 14px;
}

.dialog-actions {
  display: flex;
  gap: 10px;
}

.dialog-actions > button {
  flex: 1;
}
.import-title {
  font-size: var(--fs-head);
  margin-bottom: 6px;
}

.import-meta {
  font-size: var(--fs-note);
  color: var(--ink);
  word-break: break-all;
  margin-bottom: 4px;
}

.import-warn {
  font-size: var(--fs-note);
  color: var(--coral);
  margin-bottom: 10px;
}

.import-actions {
  display: flex;
  gap: 10px;
}

.import-actions > button {
  flex: 1;
}
</style>
