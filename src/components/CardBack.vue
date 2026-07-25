<script setup>
import { useDeck } from '../lib/use-deck.js'

defineProps({
  selected: { type: Boolean, default: false }
})

const { backUrl, manifest } = useDeck()
</script>

<template>
  <div class="card-back" :class="{ selected }">
    <img v-if="manifest" :src="backUrl()" alt="" draggable="false" />
    <div v-else class="fallback" />
  </div>
</template>

<style scoped>
.card-back {
  aspect-ratio: 300 / 527; /* 韦特牌面比例 */
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  transition: transform 0.2s, box-shadow 0.2s;
}

.card-back.selected {
  box-shadow: 0 0 0 2px var(--gold-bright), 0 2px 12px rgba(212, 175, 55, 0.35);
  transform: translateY(-6px);
}

.card-back img,
.fallback {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.fallback {
  background: linear-gradient(135deg, var(--bg-card), var(--bg-inset));
}
</style>
