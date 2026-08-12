<script setup>
// 学习助教（M4 Task 5）：章节页右下角悬浮按钮 → 针对本章提问。
import { ref } from 'vue'
import { buildTutorMessages } from '../lib/ai-prompts.js'
import { useSettingsStore } from '../stores/settings.js'
import ChatStream from './ChatStream.vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  chapterTitle: { type: String, required: true },
  content: { type: String, default: '' }
})

const settings = useSettingsStore()
const open = ref(false)
const question = ref('')
const started = ref(false)
const turn = ref(0)
const messages = ref([])

function ask() {
  const q = question.value.trim()
  if (!q) return
  messages.value = buildTutorMessages({ chapterTitle: props.chapterTitle, content: props.content, userQuestion: q })
  turn.value++
  started.value = true
  question.value = ''
}

function toggle() {
  open.value = !open.value
  if (!open.value) {
    started.value = false
  }
}
</script>

<template>
  <div v-if="settings.hasAI">
    <div v-if="open" class="panel card">
      <div class="panel-head">
        <span class="panel-title">助教 · 本章问答</span>
        <button class="close btn-text" @click="toggle">×</button>
      </div>
      <div v-if="started" class="chat-wrap">
        <ChatStream :key="turn" :messages="messages" />
      </div>
      <div class="ask">
        <input v-model="question" class="ask-input" type="text" placeholder="问一个关于本章的问题" @keyup.enter="ask" />
        <button class="btn-solid" @click="ask"><AppIcon name="arrow" :size="15" /></button>
      </div>
    </div>
    <button class="fab" aria-label="学习助教" @click="toggle">
      <AppIcon name="learn" :size="22" />
    </button>
  </div>
</template>

<style scoped>
.fab {
  position: fixed;
  right: 18px;
  bottom: calc(28px + env(safe-area-inset-bottom, 0px));
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: none;
  background: var(--gold);
  color: var(--on-gold);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-pop);
  cursor: pointer;
  z-index: 20;
}

.panel {
  position: fixed;
  right: 18px;
  bottom: calc(92px + env(safe-area-inset-bottom, 0px));
  width: min(88vw, 380px);
  padding: 14px;
  z-index: 21;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.panel-title {
  font-size: var(--fs-note);
  font-weight: var(--w-strong);
  color: var(--gold-text);
}

.close {
  font-size: 1.25rem;
  padding: 4px 8px;
  line-height: 1;
}

.chat-wrap {
  max-height: 50vh;
  overflow-y: auto;
}

.ask {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.ask-input {
  flex: 1;
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: var(--radius-btn);
  padding: 10px 12px;
  color: var(--ink);
  font-size: 1rem;
}

.ask-input:focus {
  outline: none;
  border-color: var(--gold-deep);
}
</style>
