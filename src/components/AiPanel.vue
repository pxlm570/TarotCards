<script setup>
// AI 深度解读区（M4 Task 4）：流式输出 + 多轮追问。无 key 时显示引导卡。
import { ref, computed, onMounted } from 'vue'
import cardsData from '../data/cards.json'
import { useReadingStore } from '../stores/reading.js'
import { useSettingsStore } from '../stores/settings.js'
import { customAIAllowed, supabase } from '../lib/supabase.js'
import { buildReadingMessages } from '../lib/ai-prompts.js'
import { tap } from '../lib/feedback.js'
import ChatStream from './ChatStream.vue'
import AppIcon from './AppIcon.vue'

const reading = useReadingStore()
const settings = useSettingsStore()
const cardById = new Map(cardsData.map((c) => [c.id, c]))

const started = ref(false)
const done = ref(false)
const turn = ref(0)
const conversation = ref([])
const followUp = ref('')
const tier = ref('standard')
const deepAvailable = ref(true)
const deepStatusLoading = ref(false)
const standardRemaining = ref(null)

async function refreshDeepStatus() {
  if (effectiveMode.value !== 'default' || !supabase) return
  deepStatusLoading.value = true
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) return
    const response = await fetch('/api/ai/status', {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      cache: 'no-store'
    })
    const status = await response.json()
    if (response.ok) {
      deepAvailable.value = Boolean(status.deepAvailable)
      standardRemaining.value = Number.isFinite(status.standardRemaining) ? status.standardRemaining : null
    }
  } catch {
    // 状态接口失败时保留可点击状态，让服务端额度校验给出权威结果。
  } finally {
    deepStatusLoading.value = false
  }
}

onMounted(refreshDeepStatus)

const personaLabel = computed(() => ({ gentle: '温柔治愈', direct: '直率犀利', scholar: '学术严谨' }[settings.persona] ?? '温柔治愈'))

// 自定义入口被关闭时强制按默认 AI 展示（与 ai-client 的分流保持一致）
const effectiveMode = computed(() => (customAIAllowed ? settings.aiMode : 'default'))

function buildInitMessages() {
  return buildReadingMessages({
    question: reading.question,
    domain: reading.domain,
    spread: reading.spread,
    drawn: reading.drawn,
    cardsData: cardsData
  })
}

function startAI(requestTier = 'standard') {
  tap()
  tier.value = requestTier
  conversation.value = buildInitMessages()
  turn.value++
  started.value = true
  done.value = false
}

function onDone(full) {
  if (full?.trim()) conversation.value = [...conversation.value, { role: 'assistant', content: full }]
  done.value = true
  if (tier.value === 'deep') {
    if (effectiveMode.value === 'default') refreshDeepStatus()
    // 深度额度按一次首轮请求计费；追问回到日常 AI，不会再次占用当天额度。
    tier.value = 'standard'
  }
}

function ask() {
  const q = followUp.value.trim()
  if (!q || !done.value) return
  conversation.value = [...conversation.value, { role: 'user', content: q }]
  followUp.value = ''
  turn.value++
  done.value = false
}
</script>

<template>
  <div class="ai-panel">
    <template v-if="!settings.hasAI">
      <div class="no-key card-dashed">
        <AppIcon name="sparkle" :size="18" />
        <p>{{ customAIAllowed ? '配置 API key 后解锁 AI 深度解读' : 'AI 解读暂未开放，请稍后再来' }}</p>
        <router-link v-if="customAIAllowed" to="/profile" class="btn-ghost">去设置</router-link>
      </div>
    </template>

    <template v-else>
      <div v-if="!started" class="ai-options">
        <button class="ai-start btn-solid btn-block" @click="startAI('standard')">
          <AppIcon name="sparkle" :size="18" />
          <span><strong>AI 解读</strong><small>快速梳理牌面与问题</small></span>
        </button>
        <button
          class="ai-deep btn-ghost btn-block"
          :disabled="effectiveMode === 'default' && (!deepAvailable || deepStatusLoading)"
          @click="startAI(effectiveMode === 'default' ? 'deep' : 'standard')"
        >
          <AppIcon name="star" :size="18" />
          <span><strong>深度解读</strong><small>{{ effectiveMode === 'default' ? (deepAvailable ? '每日限一次，深入梳理牌阵' : '今日额度已用完，明天再来') : '使用你自己的模型服务' }}</small></span>
        </button>
      </div>
      <p v-if="effectiveMode === 'default' && standardRemaining !== null" class="quota-note">今日普通解读剩余 {{ standardRemaining }} 次</p>
      <div v-else class="active">
        <p class="meta">星语 · {{ personaLabel }}</p>
        <ChatStream :key="turn" :messages="conversation" :tier="tier" @done="onDone" />
        <div v-if="done" class="follow">
          <input v-model="followUp" class="follow-input" type="text" placeholder="继续追问…" @keyup.enter="ask" />
          <button class="btn-solid" @click="ask"><AppIcon name="arrow" :size="15" /></button>
        </div>
      </div>
    </template>

    <p class="disclaimer">AI 解读仅供自我探索参考，不替代专业意见。</p>
  </div>
</template>

<style scoped>
.no-key {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: var(--sp-3);
  color: var(--dim);
  text-align: center;
}

.ai-options { display: grid; gap: 10px; }
.ai-options button { display: flex; align-items: center; justify-content: flex-start; gap: 10px; text-align: left; }
.ai-options button span { display: grid; gap: 2px; }
.quota-note { margin-top: 4px; text-align: center; color: var(--dim); font-size: var(--fs-note); }
.ai-options small { color: currentColor; opacity: .78; font-size: var(--fs-note); font-weight: 400; }
.ai-deep { justify-content: flex-start; }
.ai-deep:disabled { opacity: .55; }

.no-key p {
  font-size: var(--fs-note);
}

.active .meta {
  font-size: var(--fs-note);
  color: var(--gold-text);
  font-weight: var(--w-strong);
  margin-bottom: 8px;
}

.follow {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.follow-input {
  flex: 1;
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: var(--radius-btn);
  padding: 10px 12px;
  color: var(--ink);
  font-size: 1rem;
}

.follow-input:focus {
  outline: none;
  border-color: var(--gold-deep);
}

.disclaimer {
  font-size: 0.6875rem;
  color: var(--dim);
  text-align: center;
  margin-top: 8px;
}
</style>
