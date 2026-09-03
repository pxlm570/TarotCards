<script setup>
// 流式对话渲染（M4 Task 4）：接收 messages 数组，逐块流式输出，可中止。
// 生命周期与错误分类统一走 useStream：空闲超时给专属文案走重试、卸载即中止、
// 用户主动中止保留半截文本（此前本组件把超时误当用户中止吞掉，形成无提示死端）。
import { useStream } from '../composables/use-stream.js'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  messages: { type: Array, required: true },
  placeholder: { type: String, default: '思考中…' }
})

const emit = defineEmits(['done'])

const { text, error, streaming, start, stop } = useStream(() => props.messages, {
  immediate: true,
  onDone: () => emit('done')
})
const retry = start
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
    <div v-else-if="error" class="actions">
      <button class="stop btn-ghost" @click="retry"><AppIcon name="arrow" :size="14" style="transform: rotate(90deg)" /> 重试</button>
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
