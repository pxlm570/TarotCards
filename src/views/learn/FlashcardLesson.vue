<script setup>
// 闪卡课：包装 FlashcardSession，完成时给该 lesson 打勾（完整走完才算完成）。
import FlashcardSession from '../../components/FlashcardSession.vue'
import { useLearningStore } from '../../stores/learning.js'
import { toast } from '../../lib/feedback.js'

const props = defineProps({
  chapterId: { type: String, required: true },
  lessonId: { type: String, required: true },
  cardIds: { type: Array, required: true }
})

const learning = useLearningStore()

function onComplete() {
  learning.completeLesson(props.chapterId, props.lessonId)
  toast('卡牌复习完成', 'success')
}
</script>

<template>
  <div>
    <p class="tip">看图回忆这张牌，再翻面核对关键词，按熟悉程度打分。</p>
    <FlashcardSession :card-ids="cardIds" @complete="onComplete" />
  </div>
</template>

<style scoped>
.tip {
  text-align: center;
  font-size: var(--fs-note);
  color: var(--dim);
  margin-bottom: var(--sp-2);
}
</style>
