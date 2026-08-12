<script setup>
// Mirror 统计面板（M3 Task 5）：最常出现的牌、花色分布、正逆位比例、近 30 天频次、领域分布。
import { computed } from 'vue'
import cardsData from '../data/cards.json'
import { topCards, suitDist, orientationDist, domainDist, dailyFreq } from '../lib/mirror.js'
import { useDeck } from '../lib/use-deck.js'

const props = defineProps({
  readings: { type: Array, required: true }
})

const { cardUrl } = useDeck()
const cardById = new Map(cardsData.map((c) => [c.id, c]))

const SUIT_LABEL = { major: '大阿尔克那', wands: '权杖', cups: '圣杯', swords: '宝剑', pentacles: '星币' }
const DOMAIN_LABEL = { love: '感情', career: '事业', wealth: '财运', study: '学业', general: '综合' }

const top = computed(() => topCards(props.readings, 5))
const suits = computed(() => suitDist(props.readings))
const orient = computed(() => orientationDist(props.readings))
const domains = computed(() => domainDist(props.readings))
const freq = computed(() => dailyFreq(props.readings, 30))

const orientPct = computed(() => {
  const t = orient.value.upright + orient.value.reversed
  return t ? Math.round((orient.value.upright / t) * 100) : 0
})
const suitMax = computed(() => Math.max(1, ...Object.values(suits.value)))
const domainMax = computed(() => Math.max(1, ...Object.values(domains.value)))
const freqMax = computed(() => Math.max(1, ...freq.value.map((f) => f.count)))
</script>

<template>
  <div v-if="readings.length >= 5" class="mirror">
    <section class="block card">
      <h2 class="sec-title">常出现的牌</h2>
      <div class="top">
        <div v-for="t in top" :key="t.cardId" class="top-item">
          <img v-if="cardUrl(t.cardId)" class="top-img" :src="cardUrl(t.cardId)" :alt="t.cardId" />
          <span class="top-name">{{ cardById.get(t.cardId)?.name }}</span>
          <span class="top-count">{{ t.count }} 次</span>
        </div>
      </div>
    </section>

    <section class="block card">
      <h2 class="sec-title">花色分布</h2>
      <div v-for="(v, k) in suits" :key="k" class="bar-row">
        <span class="bar-label">{{ SUIT_LABEL[k] }}</span>
        <div class="bar"><div class="bar-fill" :style="{ width: (v / suitMax) * 100 + '%' }" /></div>
        <span class="bar-num">{{ v }}</span>
      </div>
    </section>

    <section class="block card">
      <h2 class="sec-title">正逆位</h2>
      <div class="orient-row">
        <span class="orient-num">{{ orient.upright }}</span>
        <div class="orient-track"><div class="orient-fill" :style="{ width: orientPct + '%' }" /></div>
        <span class="orient-num">{{ orient.reversed }} 逆</span>
      </div>
    </section>

    <section class="block card">
      <h2 class="sec-title">近 30 天占卜频次</h2>
      <div class="freq">
        <div
          v-for="f in freq"
          :key="f.key"
          class="freq-col"
          :title="`${f.key} · ${f.count} 次`"
        >
          <div class="freq-bar" :style="{ height: (f.count / freqMax) * 100 + '%' }" />
        </div>
      </div>
    </section>

    <section class="block card">
      <h2 class="sec-title">关注领域</h2>
      <div v-for="(v, k) in domains" :key="k" class="bar-row">
        <span class="bar-label">{{ DOMAIN_LABEL[k] }}</span>
        <div class="bar"><div class="bar-fill" :style="{ width: (v / domainMax) * 100 + '%' }" /></div>
        <span class="bar-num">{{ v }}</span>
      </div>
    </section>
  </div>

  <div v-else class="empty card">
    <p class="empty-title">镜子还未显现</p>
    <p class="empty-hint">抽满 5 次后，镜子开始显现你的模式。</p>
  </div>
</template>

<style scoped>
.mirror {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.block {
  padding: var(--sp-2);
}

.sec-title {
  font-size: var(--fs-head);
  margin-bottom: 12px;
}

.top {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.top-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}

.top-img {
  width: 100%;
  aspect-ratio: 300 / 527;
  border-radius: var(--radius-img);
  object-fit: cover;
  box-shadow: var(--shadow-card);
}

.top-name {
  font-size: 0.6875rem;
  color: var(--ink);
}

.top-count {
  font-size: 0.625rem;
  color: var(--dim);
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.bar-label {
  width: 64px;
  flex-shrink: 0;
  font-size: var(--fs-note);
  color: var(--dim);
}

.bar {
  flex: 1;
  height: 10px;
  border-radius: var(--radius-pill);
  background: var(--sunk);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--gold);
}

.bar-num {
  width: 24px;
  text-align: right;
  font-size: var(--fs-note);
  color: var(--dim);
}

.orient-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.orient-track {
  flex: 1;
  height: 10px;
  border-radius: var(--radius-pill);
  background: var(--sunk);
  overflow: hidden;
}

.orient-fill {
  height: 100%;
  background: var(--gold);
}

.orient-num {
  font-size: var(--fs-note);
  color: var(--dim);
}

.freq {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 70px;
}

.freq-col {
  flex: 1;
  display: flex;
  align-items: flex-end;
  height: 100%;
}

.freq-bar {
  width: 100%;
  min-height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--gold);
}

.empty {
  padding: var(--sp-3);
  text-align: center;
}

.empty-title {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  margin-bottom: 6px;
}

.empty-hint {
  font-size: var(--fs-note);
  color: var(--dim);
}
</style>
