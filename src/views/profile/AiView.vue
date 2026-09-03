<script setup>
// AI 解读详情页：端点配置/人格/测试连接/分享链接（v1.5「我的」页收缩重构，从主页面迁入）。
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { loadSettings } from '../../lib/storage.js'
import { useSettingsStore } from '../../stores/settings.js'
import { streamChat } from '../../lib/ai-client.js'
import { renderSVG } from 'uqr'
import { useEscClose } from '../../composables/use-esc-close.js'
import { takePendingImport } from '../../lib/config-import.js'
import PageHead from '../../components/PageHead.vue'
import AppIcon from '../../components/AppIcon.vue'
import { toast } from '../../lib/feedback.js'

const route = useRoute()
const settingsStore = useSettingsStore()
const testing = ref(false)
const aiInput = ref({ ...loadSettings() })
const shareLink = ref('') // 生成的配置分享链接（二维码弹层）
const qrSvg = computed(() => (shareLink.value ? renderSVG(shareLink.value) : ''))
useEscClose(() => (shareLink.value = '')) // Esc 关闭二维码弹层

// 分享配置两段式（评审 2026-09-03）：main.js 只解析暂存并带 ?import=1 跳转到这里，
// 由用户亲眼确认「应用/放弃」——不再静默写入，防伪造链接静默替换 AI 端点。
const pendingImport = ref(null)
onMounted(() => {
  if (route.query.import === '1') pendingImport.value = takePendingImport()
})
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
  settingsStore.update(patch)
  Object.assign(aiInput.value, patch)
}

async function testConnection() {
  testing.value = true
  try {
    // for-await + break：让 generator 走完 finally 释放 reader/连接（.next() 丢弃 generator 会泄漏）
    for await (const _d of streamChat({ messages: [{ role: 'user', content: 'ping' }] })) break
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
    <PageHead title="AI 解读" back-to="/profile" back-label="我的" sub="baseUrl / 模型 / key 全部自填，任何 OpenAI 兼容端点都行。key 只存在本机浏览器。不配置时应用 100% 可用。" />

    <!-- 分享配置确认条：链接导入的第二段（第一段在 main.js 暂存） -->
    <section v-if="pendingImport" class="card block import-banner">
      <p class="import-title">检测到分享的 AI 配置</p>
      <p class="import-meta">
        {{ pendingImport.baseUrl || '（未填端点）' }} · {{ pendingImport.model || '（未填模型）' }} ·
        {{ pendingImport.apiKey ? '含 API key' : '不含 key' }}
      </p>
      <p class="import-warn">只应用来源可信的配置；应用后你的提问会发送到该端点。</p>
      <div class="import-actions">
        <button class="btn-ghost" @click="discardImport">放弃</button>
        <button class="btn-solid" @click="applyImport">应用</button>
      </div>
    </section>

    <section class="card block">
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
      <div class="persona">
        <button
          v-for="p in [['gentle', '温柔治愈'], ['direct', '直率犀利'], ['scholar', '学术严谨']]"
          :key="p[0]"
          class="chip"
          :class="{ on: aiInput.persona === p[0] }"
          @click="saveAI({ persona: p[0] })"
        >{{ p[1] }}</button>
      </div>
      <button class="btn-ghost btn-block" :class="{ 'is-loading': testing }" :disabled="testing" @click="testConnection">测试连接</button>
      <button class="btn-ghost btn-block" style="margin-top:8px" @click="genShareLink">生成配置分享链接（复制）</button>
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
