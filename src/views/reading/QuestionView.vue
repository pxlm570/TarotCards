<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useReadingStore } from '../../stores/reading.js'

const router = useRouter()
const store = useReadingStore()

const question = ref(store.question)
const domain = ref(store.domain)

const chips = [
  { value: 'love', label: '感情' },
  { value: 'career', label: '事业' },
  { value: 'wealth', label: '财运' },
  { value: 'study', label: '学业' },
  { value: 'general', label: '综合' },
  { value: null, label: '随心抽' }
]

function pick(value) {
  domain.value = value
}

function confirm() {
  if (store.phase !== 'questioning') return // 防双击
  store.submitQuestion(question.value.trim(), domain.value)
  router.replace('/reading/shuffle')
}
</script>

<template>
  <div class="question">
    <h1 class="title">你想问什么？</h1>
    <p class="subtitle">问题越具体，牌给的回应越清晰。也可以什么都不写，随心一抽。</p>

    <textarea
      v-model="question"
      class="input"
      rows="3"
      maxlength="200"
      placeholder="例如：接下来三个月，我该把重心放在哪里？"
    />
    <p class="privacy">你的问题和记录只保存在这台设备上</p>

    <div class="chips">
      <button
        v-for="chip in chips"
        :key="chip.label"
        class="chip"
        :class="{ on: domain === chip.value }"
        @click="pick(chip.value)"
      >
        {{ chip.label }}
      </button>
    </div>

    <button class="confirm" @click="confirm">开始洗牌</button>
  </div>
</template>

<style scoped>
.question {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 15vh 24px 32px;
  display: flex;
  flex-direction: column;
}

.title {
  font-size: 1.375rem;
  margin-bottom: 10px;
}

.subtitle {
  color: var(--moon-dim);
  font-size: 0.875rem;
  line-height: 1.8;
  margin-bottom: 28px;
}

.input {
  width: 100%;
  background: var(--bg-card);
  border: 1px solid transparent;
  border-radius: var(--radius-card);
  padding: 14px;
  color: var(--moon);
  font-family: var(--sans);
  font-size: 1rem; /* ≥16px：15px 会触发 iOS 聚焦自动放大且不回弹 */
  line-height: 1.7;
  resize: none;
}

.input:focus {
  outline: none;
  border-color: var(--gold);
}

.privacy {
  font-size: 0.75rem;
  color: var(--moon-dim);
  margin: 8px 2px 24px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 40px;
}

.chip {
  padding: 11px 18px; /* 触控目标 ≥44px */
  border-radius: 999px;
  border: 1px solid var(--bg-card);
  background: var(--bg-card);
  color: var(--moon-dim);
  font-size: 0.875rem;
  font-family: var(--sans);
  cursor: pointer;
  transition: all 0.2s;
}

.chip.on {
  border-color: var(--gold);
  color: var(--gold-bright);
  background: rgba(184, 145, 47, 0.12);
}

.confirm {
  margin-top: auto;
  padding: 14px;
  border: none;
  border-radius: var(--radius-card);
  background: var(--gold);
  color: var(--on-gold);
  font-size: 1rem;
  font-family: var(--sans);
  cursor: pointer;
}
</style>
