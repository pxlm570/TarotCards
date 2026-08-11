<script setup>
// 牌库网格（M2 Task 5）：响应式网格 + 懒加载牌面。
import { useDeck } from '../lib/use-deck.js'

defineProps({
  cards: { type: Array, required: true }
})

const emit = defineEmits(['select'])
const { cardUrl } = useDeck()
</script>

<template>
  <div class="grid">
    <button
      v-for="c in cards"
      :key="c.id"
      class="cell"
      @click="emit('select', c)"
    >
      <img v-if="cardUrl(c.id)" class="img" :src="cardUrl(c.id)" :alt="c.name" loading="lazy" />
      <div v-else class="img skeleton" />
      <span class="name">{{ c.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px 10px;
}

@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(6, 1fr);
  }
}

.cell {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.img {
  width: 100%;
  aspect-ratio: 300 / 527;
  border-radius: var(--radius-img);
  object-fit: cover;
  box-shadow: var(--shadow-card);
  transition: transform var(--t-press) var(--ease-out);
}

.cell:active .img {
  transform: scale(0.96);
}

.name {
  font-size: 0.75rem;
  color: var(--dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
</style>
