<script setup>
// 时间线条目（M3 Task 2）：牌阵名 + 问题摘要 + 牌面缩略横排 + 每日一抽标记。
import spreadsData from '../data/spreads.json'
import { useDeck } from '../lib/use-deck.js'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  reading: { type: Object, required: true }
})

const emit = defineEmits(['open'])
const { cardUrl } = useDeck()
const spreadName = spreadsData.find((s) => s.id === props.reading.spreadId)?.name ?? '占卜'
</script>

<template>
  <button class="timeline-item card-press" @click="emit('open', reading.id)">
    <div class="row-top">
      <span class="spread badge">{{ spreadName }}</span>
      <span v-if="reading.isDaily" class="daily"><AppIcon name="moon" :size="13" /> 每日一抽</span>
    </div>
    <p v-if="reading.question" class="question">{{ reading.question }}</p>
    <div class="thumbs">
      <img
        v-for="(c, i) in reading.cards.slice(0, 5)"
        :key="i"
        class="thumb"
        :class="{ reversed: c.reversed }"
        :src="cardUrl(c.cardId)"
        :alt="c.cardId"
        loading="lazy"
      />
    </div>
  </button>
</template>

<style scoped>
.timeline-item {
  width: 100%;
  text-align: left;
  padding: 14px;
  margin-bottom: 12px;
}

.row-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.spread {
  font-size: 0.6875rem;
}

.daily {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.6875rem;
  color: var(--dim);
}

.question {
  font-size: var(--fs-body);
  font-weight: var(--w-strong);
  margin-bottom: 10px;
  line-height: 1.6;
}

.thumbs {
  display: flex;
  gap: 6px;
}

.thumb {
  width: 40px;
  aspect-ratio: 300 / 527;
  border-radius: var(--radius-img);
  object-fit: cover;
  box-shadow: var(--shadow-card);
}

.thumb.reversed {
  transform: rotate(180deg);
}
</style>
