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
  border-radius: var(--radius-img);
  overflow: hidden;
  box-shadow: var(--shadow-card); /* 实体牌的落影——UI 其余部分不用投影 */
  transition: transform var(--t-fast) var(--ease-out), box-shadow var(--t-fast),
    outline-color var(--t-fast);
  outline: 3px solid transparent;
  outline-offset: -1px;
}

/* 选中即「上浮 + 金边 + 金辉」（仪式链定稿 ④ 的即时反馈） */
.card-back.selected {
  transform: translateY(-14px) scale(1.04);
  outline-color: var(--gold);
  box-shadow: var(--shadow-card), 0 0 14px var(--gold-glow);
}

.card-back img,
.fallback {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.fallback {
  background: var(--sunk);
}

@media (prefers-reduced-motion: reduce) {
  .card-back {
    transition: none;
  }
  .card-back.selected {
    transform: none;
  }
}
</style>
