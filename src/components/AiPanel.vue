<script setup>
// AI 深度解读区（M4 Task 4）：流式输出 + 多轮追问。无 key 时显示引导卡。
import { ref, computed } from 'vue'
import cardsData from '../data/cards.json'
import { useReadingStore } from '../stores/reading.js'
import { useSettingsStore } from '../stores/settings.js'
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

const personaLabel = computed(() => ({ gentle: '温柔治愈', direct: '直率犀利', scholar: '学术严谨' }[settings.persona] ?? '温柔治愈'))

function buildInitMessages() {
  return buildReadingMessages({
    question: reading.question,
    domain: reading.domain,
    spread: reading.spread,
    drawn: reading.drawn,
    cardsData: cardsData
  })
}

function startDeep() {
  tap()
  conversation.value = buildInitMessages()
  turn.value++
  started.value = true
  done.value = false
}

function onDone() {
  done.value = true
}

function ask() {
  const q = followUp.value.trim()
  if (!q) return
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
        <p>配置 API key 后解锁 AI 深度解读</p>
        <router-link to="/profile" class="btn-ghost">去设置</router-link>
      </div>
    </template>

    <template v-else>
      <button v-if="!started" class="ai-start btn-solid btn-block" @click="startDeep">
        <AppIcon name="sparkle" :size="18" />
        AI 深度解读（约 1-2k tokens）
      </button>
      <div v-else class="active">
        <p class="meta">星语 · {{ personaLabel }}</p>
        <ChatStream :key="turn" :messages="conversation" @done="onDone" />
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
