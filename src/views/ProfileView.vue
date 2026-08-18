<script setup>
// M4 交付完整设置页（AI 配置/主题/导出导入）。M1 验收需要：逆位与代抽的临时开关。
// M1.5 起提供主题三态（跟随系统 / 浅色 / 暗夜）。
// M3：XP 等级条、本命牌（生日 → 人格/灵魂牌）。
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { loadSettings, saveSettings } from '../lib/storage.js'
import { setTheme, THEME_VALUES } from '../lib/theme.js'
import { useProfileStore } from '../stores/profile.js'
import { birthCards } from '../lib/birth-cards.js'
import { useDeck } from '../lib/use-deck.js'
import cardsData from '../data/cards.json'
import XpBar from '../components/XpBar.vue'
import AppIcon from '../components/AppIcon.vue'
import { toast, success } from '../lib/feedback.js'
import { collectBackup, parseImport, applyImport } from '../lib/backup.js'
import { useSettingsStore } from '../stores/settings.js'
import { streamChat } from '../lib/ai-client.js'
import { applyMotionPreference } from '../lib/feedback.js'
import { renderSVG } from 'uqr'
import { useEscClose } from '../composables/useEscClose.js'

const settingsStore = useSettingsStore()
const router = useRouter()

const settings = ref(loadSettings())
const profile = useProfileStore()
const { cardUrl } = useDeck()
const cardById = new Map(cardsData.map((c) => [c.id, c]))

const THEME_LABEL = { auto: '跟随系统', light: '浅色', dark: '暗夜' }

function toggle(key) {
  settings.value = saveSettings({ [key]: !settings.value[key] })
}

function pickTheme(value) {
  setTheme(value)
  settings.value = loadSettings()
}

function toggleMotion() {
  const next = !settings.value.reducedMotion
  settings.value = saveSettings({ reducedMotion: next })
  applyMotionPreference() // 立即生效
}

function pickFontSize(size) {
  settings.value = saveSettings({ fontSize: size })
  const el = document.documentElement
  if (size === 'large') el.setAttribute('data-fontsize', 'large')
  else el.removeAttribute('data-fontsize')
}

// ---- 本命牌 ----
const birthdayInput = ref('')
const birth = computed(() => {
  if (!profile.birthday) return null
  const [y, m, d] = profile.birthday.split('-').map(Number)
  return birthCards(y, m, d)
})

function saveBirthday() {
  const v = birthdayInput.value
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return
  profile.setBirthday(v)
  success()
  toast('已生成你的本命牌', 'success')
}

// ---- 数据导出/导入 ----
const fileRef = ref(null)
const pendingImport = ref(null)
function goCollection() {
  router.push('/collection')
}

function doExport() {
  const b = collectBackup()
  const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `星语塔罗-backup-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast('已导出备份')
}

function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      pendingImport.value = parseImport(String(reader.result))
      toast('已读取备份文件，请选择导入方式', 'info')
    } catch {
      pendingImport.value = null
      toast('文件无效，无法导入', 'info')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

function doImport(mode) {
  if (!pendingImport.value) return
  const label = mode === 'merge' ? '合并' : '全量覆盖'
  if (!window.confirm(`确定${label}导入吗？${mode === 'overwrite' ? '现有数据将被替换。' : '新记录将并入，重复记录跳过。'}`)) return
  applyImport(pendingImport.value, mode)
  pendingImport.value = null
  toast('导入成功', 'success')
  setTimeout(() => location.reload(), 600)
}

// ---- AI 配置 ----
const testing = ref(false)
const aiInput = ref({ ...loadSettings() })
const shareLink = ref('') // 生成的配置分享链接（二维码弹层）
const qrSvg = computed(() => (shareLink.value ? renderSVG(shareLink.value) : ''))
useEscClose(() => (shareLink.value = '')) // Esc 关闭二维码弹层

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
    await streamChat({ messages: [{ role: 'user', content: 'ping' }], signal: new AbortController().signal }).next()
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

// 清空所有本地数据（危险，二次确认）
function clearAll() {
  if (!window.confirm('确定清空所有数据吗？记录、进度、设置、成就都将被删除，且不可恢复。建议先导出备份。')) return
  if (!window.confirm('再次确认：真的要清空全部数据吗？')) return
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('tarot.')) localStorage.removeItem(k)
  }
  toast('已清空')
  setTimeout(() => location.reload(), 600)
}
</script>

<template>
  <div class="profile">
    <h1 class="title">我的</h1>

    <section class="card block">
      <XpBar show-next />
    </section>

    <section class="card block">
      <h2 class="card-title">外观</h2>
      <div class="chips">
        <button
          v-for="value in THEME_VALUES"
          :key="value"
          class="chip"
          :class="{ on: settings.theme === value }"
          @click="pickTheme(value)"
        >
          {{ THEME_LABEL[value] }}
        </button>
      </div>
      <label class="row">
        <div>
          <span class="row-name">减弱动效</span>
          <p class="row-hint">减少缩放与闪烁，更适合夜间或敏感用户</p>
        </div>
        <input type="checkbox" :checked="settings.reducedMotion" @change="toggleMotion" />
      </label>
      <div class="chips" style="margin-top: 10px">
        <button
          v-for="s in [['standard', '标准'], ['large', '睡前大字']]"
          :key="s[0]"
          class="chip"
          :class="{ on: settings.fontSize === s[0] }"
          @click="pickFontSize(s[0])"
        >{{ s[1] }}</button>
      </div>
    </section>

    <section class="card block">
      <h2 class="card-title">占卜偏好</h2>
      <label class="row">
        <div>
          <span class="row-name">启用逆位</span>
          <p class="row-hint">逆位解读更完整，也更考验功底（建议学完第 5 章再开）</p>
        </div>
        <input type="checkbox" :checked="settings.reversalsEnabled" @change="toggle('reversalsEnabled')" />
      </label>
      <label class="row">
        <div>
          <span class="row-name">为我代抽</span>
          <p class="row-hint">抽牌环节自动完成，适合快速占卜</p>
        </div>
        <input type="checkbox" :checked="settings.autoDraw" @change="toggle('autoDraw')" />
      </label>
    </section>

    <section class="card block">
      <h2 class="card-title">本命牌</h2>
      <template v-if="birth">
        <div class="birth-cards">
          <div v-for="id in birth.majors" :key="id" class="birth-card">
            <img v-if="cardUrl(id)" class="birth-img" :src="cardUrl(id)" :alt="id" />
            <span class="birth-name">{{ cardById.get(id)?.name }}</span>
          </div>
        </div>
        <p class="birth-display">人格 / 灵魂 · {{ birth.display }}</p>
        <p class="birth-hint">「{{ birth.majors.map((id) => cardById.get(id)?.name).join('」与「') }}」是你的本命牌，代表着你的内在与灵魂课题。</p>
        <button class="change btn-text" @click="profile.setBirthday(''); birthdayInput = ''">重新输入生日</button>
      </template>
      <template v-else>
        <p class="row-hint">输入生日，找到属于你的牌。</p>
        <input v-model="birthdayInput" class="birth-input" type="date" max="2026-12-31" />
        <button class="birth-save btn-ghost btn-block" :disabled="!/^\d{4}-\d{2}-\d{2}$/.test(birthdayInput)" @click="saveBirthday">算出我的本命牌</button>
      </template>
    </section>
    <section class="card block">
      <h2 class="card-title">数据</h2>
      <p class="row-hint">记录、进度与设置都在本机。换设备可导出备份再导入。</p>
      <button class="btn-ghost btn-block collection-entry" @click="goCollection">
        <AppIcon name="star" :size="14" />
        收藏馆 · 牌面收集与鉴赏
      </button>
      <button class="btn-ghost btn-block" style="margin-top: 8px" @click="doExport">导出备份</button>
      <button class="btn-ghost btn-block" style="margin-top: 8px" @click="fileRef.click()">导入备份</button>
      <input ref="fileRef" type="file" accept="application/json,.json" style="display: none" @change="onFileChange" />
      <div v-if="pendingImport" class="import-actions">
        <button class="btn-solid" style="flex:1" @click="doImport('merge')">合并</button>
        <button class="btn-ghost" style="flex:1" @click="doImport('overwrite')">全量覆盖</button>
      </div>
      <button class="clear-data btn-text" @click="clearAll">
        <AppIcon name="journal" :size="14" />
        清空所有数据（危险）
      </button>
    </section>

    <section class="card block">
      <h2 class="card-title">AI 解读</h2>
      <p class="row-hint">baseUrl / 模型 / key 全部自填，任何 OpenAI 兼容端点都行。key 只存在本机浏览器。</p>
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

    <section class="card block">
      <h2 class="card-title">关于</h2>
      <p class="row-hint">星语塔罗 · 私人塔罗空间。牌面为 Pamela Colman Smith 绘制的韦特塔罗（1909，公有领域）；牌意以《The Pictorial Key to the Tarot》为底本中文自撰。定位为塔罗文化学习与自我探索工具，不提供医疗、法律或财务建议。</p>
      <router-link to="/welcome" class="btn-ghost btn-block" style="margin-top:10px">重看新手引导</router-link>
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
.profile {
  padding: var(--sp-3) 20px var(--sp-4);
}

.title {
  font-size: var(--fs-title);
  margin-bottom: var(--sp-3);
}

.block {
  padding: var(--sp-2);
  margin-bottom: var(--sp-2);
}

.card-title {
  font-size: var(--fs-head);
  margin-bottom: 12px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-2);
  padding: 10px;
  margin: 0 -10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background var(--t-press);
}

.row:active {
  background: var(--sunk);
}

.row-name {
  font-size: var(--fs-body);
  font-weight: var(--w-strong);
}

.row-hint {
  font-size: var(--fs-note);
  color: var(--dim);
  margin-top: 2px;
  line-height: 1.7;
}

.row input {
  width: 22px;
  height: 22px;
  accent-color: var(--gold-deep);
  flex-shrink: 0;
}

.birth-cards {
  display: flex;
  justify-content: center;
  gap: 18px;
  margin-bottom: 10px;
}

.birth-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.birth-img {
  width: 92px;
  aspect-ratio: 300 / 527;
  border-radius: var(--radius-img);
  object-fit: cover;
  box-shadow: var(--shadow-card);
}

.birth-name {
  font-size: var(--fs-note);
  font-weight: var(--w-strong);
  color: var(--gold-text);
}

.birth-display {
  text-align: center;
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  color: var(--gold-text);
  margin-bottom: 6px;
}

.birth-hint {
  text-align: center;
  font-size: var(--fs-note);
  color: var(--dim);
  line-height: 1.7;
}

.change {
  display: block;
  margin: 10px auto 0;
  color: var(--dim);
}

.birth-input {
  width: 100%;
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 12px;
  color: var(--ink);
  font-size: 1rem;
  margin-bottom: 10px;
}

.birth-input:focus {
  outline: none;
  border-color: var(--gold-deep);
}

.import-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.clear-data {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 14px auto 0;
  color: var(--dim);
  font-size: 0.75rem;
  padding: 8px;
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
</style>
