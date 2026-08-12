<script setup>
// 「我先解」AI 点评（M4 Task 4）：在静态练习模式上叠加 AI 点评我的理解。
import { ref } from 'vue'
import cardsData from '../data/cards.json'
import { useReadingStore } from '../stores/reading.js'
import { useSettingsStore } from '../stores/settings.js'
import { buildSelfReadMessages } from '../lib/ai-prompts.js'
import ChatStream from './ChatStream.vue'

const reading = useReadingStore()
const settings = useSettingsStore()

const props = defineProps({
  practiceText: { type: String, required: true }
})

const started = ref(false)
const turn = ref(0)
const messages = ref([])

function startReview() {
  messages.value = buildSelfReadMessages({
    drawn: reading.drawn,
    cardsData: cardsData,
    userInterpretation: props.practiceText
  })
  turn.value++
  started.value = true
}
</script>

<template>
  <div class="self">
    <template v-if="!settings.hasAI">
      <p class="no-key">配置 AI 后，这里会让「星语」点评你的理解。</p>
    </template>
    <template v-else>
      <button v-if="!started" class="btn-ghost btn-block" @click="startReview">让 AI 点评我的理解</button>
      <ChatStream v-else :key="turn" :messages="messages" />
    </template>
  </div>
</template>

<style scoped>
.no-key {
  font-size: var(--fs-note);
  color: var(--dim);
  text-align: center;
}
</style>
