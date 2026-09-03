<script setup>
// 问题澄清（M4 Task 5）：输入问题后让 AI 判断是否清晰，模糊则追问一轮。
// 流式生命周期走 useStream（卸载即中止）；澄清是可选环节——出错直接放行原问题，不卡占卜动线。
import { ref, watch } from 'vue'
import { buildClarifyMessages } from '../lib/ai-prompts.js'
import { useStream } from '../composables/use-stream.js'
import { useEscClose } from '../composables/use-esc-close.js'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  question: { type: String, required: true }
})
const emit = defineEmits(['done', 'skip'])
useEscClose(() => emit('skip')) // Esc 关闭（视为跳过澄清）

const answer = ref('')
const needAnswer = ref(false)

const { text, error } = useStream(() => buildClarifyMessages(props.question), {
  immediate: true,
  onDone: (full) => {
    const clean = full.trim().replace(/[「」""]/g, '')
    if (clean === '清晰') emit('done', props.question)
    else needAnswer.value = true
  }
})
watch(error, (v) => {
  if (v) emit('done', props.question)
})

function submit() {
  const final = answer.value.trim() ? `${props.question}（补充：${answer.value.trim()}）` : props.question
  emit('done', final)
}
</script>

<template>
  <div class="modal" @click.self="emit('skip')">
    <div class="dialog card">
      <p class="title">让我帮你把问题问得更具体</p>
      <p v-if="needAnswer" class="q">{{ text }}</p>
      <input v-if="needAnswer" v-model="answer" class="input" type="text" placeholder="补充一句你的情况…" @keyup.enter="submit" />
      <div class="actions">
        <button class="btn-ghost" @click="emit('skip')">跳过</button>
        <button v-if="needAnswer" class="btn-solid" @click="submit">就用这个</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
  padding: 24px;
}

.dialog {
  width: 100%;
  max-width: 400px;
  padding: var(--sp-3);
}

.title {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  margin-bottom: 10px;
}

.q {
  font-size: var(--fs-body);
  line-height: 1.8;
  margin-bottom: 12px;
}

.input {
  width: 100%;
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 12px;
  color: var(--ink);
  font-size: 1rem;
  margin-bottom: 12px;
}

.actions {
  display: flex;
  gap: 10px;
}

.actions > button {
  flex: 1;
}
</style>
