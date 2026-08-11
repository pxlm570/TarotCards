<script setup>
// 图文课：渲染 article 的 blocks（heading/paragraph/card-ref/list）。
import { useDeck } from '../../lib/use-deck.js'
import AppIcon from '../../components/AppIcon.vue'
import { tap } from '../../lib/feedback.js'

defineProps({
  blocks: { type: Array, required: true }
})

const { cardUrl } = useDeck()
const emit = defineEmits(['openCard'])
</script>

<template>
  <article class="article">
    <template v-for="(b, i) in blocks" :key="i">
      <h2 v-if="b.type === 'heading'" class="a-head">{{ b.text }}</h2>
      <p v-else-if="b.type === 'paragraph'" class="a-para">{{ b.text }}</p>
      <ul v-else-if="b.type === 'list'" class="a-list">
        <li v-for="(it, j) in b.items" :key="j" class="a-li">
          <AppIcon name="star" :size="13" />
          <span>{{ it }}</span>
        </li>
      </ul>
      <button v-else-if="b.type === 'card-ref'" class="card-ref" @click="tap(); emit('openCard', b.cardId)">
        <img v-if="cardUrl(b.cardId)" class="card-ref-img" :src="cardUrl(b.cardId)" alt="" />
        <span class="card-ref-label">点我看这张牌 <AppIcon name="arrow" :size="14" /></span>
      </button>
    </template>
  </article>
</template>

<style scoped>
.article {
  line-height: 1.9;
}

.a-head {
  font-size: var(--fs-head);
  margin: 24px 0 10px;
}

.a-para {
  font-size: var(--fs-body);
  color: var(--ink);
  margin-bottom: 14px;
}

.a-list {
  margin: 6px 0 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.a-li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: var(--fs-body);
  color: var(--ink);
}

.a-li :deep(.app-icon) {
  color: var(--gold-text);
  margin-top: 6px;
  flex-shrink: 0;
}

.card-ref {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  margin: 18px 0;
  background: var(--surface);
  border: 2px dashed var(--line);
  border-radius: var(--radius-card);
  color: var(--dim);
  font-size: var(--fs-note);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--t-press) var(--ease-out), border-color var(--t-press);
}

.card-ref:active {
  transform: scale(0.98);
  border-color: var(--gold-deep);
}

.card-ref-img {
  width: 84px;
  border-radius: var(--radius-img);
  box-shadow: var(--shadow-card);
}

.card-ref-label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--gold-text);
  font-weight: var(--w-medium);
}
</style>
