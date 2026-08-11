<script setup>
// 闪卡复习会话（M2 Task 4）：按 cardIds 逐张翻面 + 三档评分（走 learning.rateCard）。
// 全部评完 emit complete。课程闪卡与「今日/全库复习」共用。
import { ref, computed } from 'vue'
import cardsData from '../data/cards.json'
import { useLearningStore } from '../stores/learning.js'
import { useDeck } from '../lib/use-deck.js'
import { tap, success } from '../lib/feedback.js'
import FlashCard from './FlashCard.vue'

const props = defineProps({
  cardIds: { type: Array, required: true }
})

const emit = defineEmits(['complete'])

const learning = useLearningStore()
const { cardUrl } = useDeck()

const cardById = new Map(cardsData.map((c) => [c.id, c]))
const index = ref(0)
const done = ref(0)

const current = computed(() => cardById.get(props.cardIds[index.value]))
const progress = computed(() => (props.cardIds.length ? index.value / props.cardIds.length : 1))
const finished = computed(() => index.value >= props.cardIds.length)

function rate(rating) {
  if (!current.value) return
  learning.rateCard(current.value.id, rating)
  done.value++
  tap()
  if (index.value + 1 >= props.cardIds.length) {
    success()
    emit('complete')
  }
  index.value++
}
</script>

<template>
  <div class="session">
    <div class="progress">
      <span>已复习 {{ done }} / {{ cardIds.length }}</span>
    </div>

    <FlashCard v-if="current" :card="current" :img="cardUrl(current.id)" />

    <div v-if="finished" class="done card">
      <p class="done-title">本组闪卡复习完成</p>
      <p class="done-hint">间隔重复会记得你今天复习过，过些天再来巩固。</p>
    </div>

    <div v-else class="ratings">
      <button class="rate btn-ghost" @click="rate('again')">不认识</button>
      <button class="rate btn-ghost" @click="rate('hard')">模糊</button>
      <button class="rate btn-solid" @click="rate('good')">认识</button>
    </div>
  </div>
</template>

<style scoped>
.session {
  display: flex;
  flex-direction: column;
  min-height: 70vh;
}

.progress {
  text-align: center;
  font-size: var(--fs-note);
  color: var(--dim);
  margin-bottom: var(--sp-3);
}

.ratings {
  display: flex;
  gap: 10px;
  margin-top: var(--sp-4);
}

.rate {
  flex: 1;
  padding: 13px;
}

.done {
  margin-top: var(--sp-4);
  padding: var(--sp-3);
  text-align: center;
}

.done-title {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  margin-bottom: 6px;
}

.done-hint {
  font-size: var(--fs-note);
  color: var(--dim);
}
</style>
