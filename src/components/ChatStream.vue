<script setup>
// 流式对话渲染（M4 Task 4）：接收 messages 数组，逐块流式输出，可中止。
import { ref, onMounted } from 'vue'
import { streamChat, AI_NOT_CONFIGURED, AIError } from '../lib/ai-client.js'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  messages: { type: Array, required: true },
  placeholder: { type: String, default: '思考中…' }
})

const emit = defineEmits(['done'])

const text = ref('')
const streaming = ref(false)
const error = ref('')
const controller = ref(null)

async function start() {
  text.value = ''
  error.value = ''
  streaming.value = true
  controller.value = new AbortController()
  try {
    for await (const delta of streamChat({ messages: props.messages, signal: controller.value.signal })) {
      text.value += delta
    }
    emit('done')
  } catch (e) {
    if (e.message === AI_NOT_CONFIGURED) error.value = '尚未配置 AI，请到「我的」页填写 key。'
    else if (e instanceof AIError) error.value = e.status === 401 ? '密钥无效' : e.status === 429 ? '请求过于频繁' : `请求失败（${e.status || '网络'}）`
    else error.value = '网络错误，请检查 baseUrl 或网络。'
  } finally {
    streaming.value = false
    controller.value = null
  }
}

function stop() {
  controller.value?.abort()
}

onMounted(start)
</script>

<template>
  <div class="chat">
    <div class="body">
      <p v-if="!text && !error && !streaming" class="idle">{{ placeholder }}</p>
      <p v-if="text" class="text">{{ text }}</p>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="streaming" class="caret" />
    </div>
    <div v-if="streaming" class="actions">
      <button class="stop btn-ghost" @click="stop"><AppIcon name="check" :size="14" /> 中止</button>
    </div>
  </div>
</template>

<style scoped>
.chat {
  border: 2px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  padding: 14px;
}

.body {
  min-height: 60px;
  max-height: 60vh;
  overflow-y: auto;
  line-height: 1.9;
  font-size: var(--fs-body);
  color: var(--ink);
  white-space: pre-wrap;
}

.idle {
  color: var(--dim);
}

.caret {
  display: inline-block;
  width: 6px;
  height: 1em;
  margin-top: 2px;
  background: var(--gold);
  animation: blink 0.8s steps(1) infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.error {
  color: var(--coral);
}

.actions {
  margin-top: 8px;
}

.stop {
  font-size: var(--fs-note);
  padding: 8px 14px;
}
</style>
