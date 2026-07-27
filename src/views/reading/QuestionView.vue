<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useReadingStore } from '../../stores/reading.js'
import AppIcon from '../../components/AppIcon.vue'

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
    <p class="privacy">
      <AppIcon name="lock" :size="13" />
      你的问题和记录只保存在这台设备上
    </p>

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

    <button class="confirm btn-solid btn-block" @click="confirm">开始洗牌</button>
  </div>
</template>

<style scoped>
/* 仪式链 ② 提问：「纸上落墨」——输入框是一张纸，不催促 */
.question {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 13vh 24px calc(var(--sp-4) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
}

.title {
  font-size: var(--fs-title);
  margin-bottom: 10px;
}

.subtitle {
  color: var(--dim);
  font-size: var(--fs-note);
  line-height: 1.8;
  margin-bottom: var(--sp-3);
}

.input {
  width: 100%;
  min-height: 96px;
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: var(--radius-btn);
  padding: 14px;
  color: var(--ink);
  font-size: 1rem; /* ≥16px：15px 会触发 iOS 聚焦自动放大且不回弹 */
  line-height: 1.8;
  resize: none;
  transition: border-color var(--t-fast);
}

.input::placeholder {
  color: var(--dim);
  opacity: 0.7;
}

.input:focus {
  outline: none;
  border-color: var(--gold-deep);
}

.privacy {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  color: var(--dim);
  margin: var(--sp-1) 2px var(--sp-3);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: var(--sp-4);
}

.confirm {
  margin-top: auto;
  padding: 15px;
}
</style>
