<script setup>
// 问题澄清（M4 Task 5）：输入问题后让 AI 判断是否清晰，模糊则追问一轮。
import { ref, onMounted } from 'vue'
import { buildClarifyMessages } from '../lib/ai-prompts.js'
import { streamChat, AI_NOT_CONFIGURED } from '../lib/ai-client.js'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  question: { type: String, required: true }
})
const emit = defineEmits(['done', 'skip'])

const text = ref('')
const answer = ref('')
const needAnswer = ref(false)

onMounted(async () => {
  try {
    let out = ''
    for await (const d of streamChat({ messages: buildClarifyMessages(props.question) })) out += d
    const clean = out.trim().replace(/[「」""]/g, '')
    if (clean === '清晰') emit('done', props.question)
    else {
      text.value = out
      needAnswer.value = true
    }
  } catch {
    emit('done', props.question) // 出错直接放行
  }
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
