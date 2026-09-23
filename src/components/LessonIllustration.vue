<script setup>
// 教学固定韦特图：换皮肤不会使符号讲解与画面不一致。
import { ref, onMounted, onUnmounted } from 'vue'
import { loadDeck, cardImageUrl } from '../lib/deck-loader.js'
import cardsData from '../data/cards.json'
defineProps({ cards: { type: Array, required: true }, compact: Boolean })
const manifest = ref(null)
const failed = ref(false)
const broken = ref(new Set())
let disposed = false
const names = Object.fromEntries(cardsData.map((c) => [c.id, c.name]))
async function load() {
  failed.value = false
  try { const value = await loadDeck('rws'); if (!disposed) manifest.value = value }
  catch { if (!disposed) failed.value = true }
}
function src(id) { return manifest.value ? cardImageUrl(manifest.value, id) : '' }
function retry() { broken.value = new Set(); load() }
onMounted(load)
onUnmounted(() => { disposed = true })
</script>
<template>
  <div class="lesson-art" :class="{ compact }">
    <div class="art-gallery" :class="{ many: cards.length > 2 }">
      <figure v-for="(card, i) in cards" :key="`${card.cardId}-${i}`">
        <img v-if="src(card.cardId) && !broken.has(i)" :src="src(card.cardId)" :alt="`${names[card.cardId]}${card.reversed ? '逆位' : '正位'}`" :class="{ reversed: card.reversed }" @error="broken = new Set([...broken, i])" />
        <div v-else class="art-placeholder" :class="{ skeleton: !failed && !broken.has(i) }">{{ names[card.cardId] }}</div>
        <figcaption v-if="!compact">{{ card.caption }}</figcaption>
      </figure>
    </div>
    <button v-if="!compact && (failed || broken.size)" class="btn-text" @click="retry">插图未能加载，点此重试</button>
    <p v-else-if="!compact" class="art-source">经典韦特 · 教学示例牌</p>
  </div>
</template>
<style scoped>
.lesson-art { padding: var(--sp-2); background: var(--sunk); border-radius: var(--radius-card); }
.art-gallery { display: flex; justify-content: center; gap: var(--sp-2); }
figure { margin: 0; flex: 1; max-width: 144px; min-width: 0; text-align: center; }
img, .art-placeholder { display: block; width: 100%; aspect-ratio: 500 / 839; object-fit: cover; border-radius: var(--radius-img); box-shadow: var(--shadow-card); }
img.reversed { transform: rotate(180deg); }
.art-placeholder { display: grid; place-items: center; color: var(--dim); font-size: var(--fs-note); }
figcaption { margin-top: 10px; color: var(--ink); font-size: var(--fs-note); line-height: 1.5; }
.many { display: grid; grid-template-columns: repeat(2, minmax(0, 112px)); }
.many figure { width: 100%; }
.art-source { margin-top: 12px; text-align: center; font-size: 11px; color: var(--dim); }
.compact { padding: 0; background: none; }
.compact figure { max-width: 76px; }
.compact .art-gallery { gap: 8px; }
</style>
