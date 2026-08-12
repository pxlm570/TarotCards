<script setup>
// 提问页（M4 后合并静心步骤）：页内呼吸提示（不再单独占屏）+ 问题输入 + AI 澄清。
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import spreads from '../../data/spreads.json'
import { useReadingStore } from '../../stores/reading.js'
import { useSettingsStore } from '../../stores/settings.js'
import AppIcon from '../../components/AppIcon.vue'
import ClarifyDialog from '../../components/ClarifyDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useReadingStore()
const settings = useSettingsStore()

const question = ref(store.question)
const domain = ref(store.domain)
const clarifying = ref(false)
const ready = ref(false)

const chips = [
  { value: 'love', label: '感情' },
  { value: 'career', label: '事业' },
  { value: 'wealth', label: '财运' },
  { value: 'study', label: '学业' },
  { value: 'general', label: '综合' },
  { value: null, label: '随心抽' }
]

// 挂载即初始化本局（替代原静心页）：选牌阵 → 直接进入提问阶段
onMounted(() => {
  const isDaily = route.query.daily === '1'
  const spreadId = isDaily ? 'single' : route.query.spread
  if (isDaily || spreadId) {
    const sid = spreadId || 'single'
    if (!spreads.some((s) => s.id === sid)) {
      router.replace('/')
      return
    }
    if (store.phase !== 'questioning' || store.spreadId !== sid || store.isDaily !== isDaily) {
      store.reset()
      store.isDaily = isDaily
      store.selectSpread(sid)
      store.beginBreathing()
      store.toQuestion()
    }
  } else if (store.phase !== 'questioning') {
    router.replace('/')
    return
  }
  ready.value = true
})

function pick(value) {
  domain.value = value
}

function doSubmit(finalQuestion) {
  clarifying.value = false
  if (store.phase !== 'questioning') return
  store.submitQuestion(finalQuestion ?? question.value.trim(), domain.value)
  router.replace('/reading/shuffle')
}

function confirm() {
  if (store.phase !== 'questioning') return
  // AI 已配置且问题非空 → 先澄清一轮（可跳过）
  if (settings.hasAI && question.value.trim()) {
    clarifying.value = true
  } else {
    doSubmit(question.value.trim())
  }
}

function cancel() {
  store.reset()
  router.replace('/')
}
</script>

<template>
  <div v-if="ready" class="question">
    <button class="back btn-text" @click="cancel">
      <AppIcon name="arrow" :size="16" style="transform: rotate(180deg)" />
      取消这局
    </button>

    <div class="breathe-hint">
      <span class="ring"><span class="ring-inner" /></span>
      <p class="breathe-text">先深呼吸，默念你的问题</p>
    </div>

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

    <ClarifyDialog
      v-if="clarifying"
      :question="question.value.trim()"
      @done="doSubmit"
      @skip="doSubmit(question.value.trim())"
    />
  </div>
</template>

<style scoped>
/* 仪式感：提问页顶部一段呼吸提示（不阻塞输入，不单独占屏） */
.question {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 10vh 24px calc(var(--sp-4) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  padding-left: 0;
  color: var(--dim);
}

.breathe-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
}

.ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid var(--gold);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: breathe 3.4s ease-in-out infinite;
}

.ring-inner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--gold-soft);
  animation: breathe 3.4s ease-in-out infinite;
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.25);
  }
}

.breathe-text {
  font-size: var(--fs-note);
  color: var(--dim);
  letter-spacing: 0.2em;
  text-indent: 0.2em;
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

@media (prefers-reduced-motion: reduce) {
  .ring,
  .ring-inner {
    animation: none;
  }
}
</style>
