<script setup>
// 牌详情页（M2 Task 5）：大牌面、关键词、正逆位切换、四领域、元素星象、符号解析。
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import cardsData from '../data/cards.json'
import { useDeck } from '../lib/use-deck.js'
import AppIcon from '../components/AppIcon.vue'
import { useBack } from '../composables/use-back.js'

const route = useRoute()
const { cardUrl } = useDeck()
const goBack = useBack()

const card = computed(() => cardsData.find((c) => c.id === route.params.cardId))
const orientation = ref('upright')

const DOMAIN_LABEL = { love: '感情', career: '事业', wealth: '财运', study: '学业' }
</script>

<template>
  <div v-if="card" class="detail">
    <header class="head">
      <!-- 智能返回：从牌库/收藏馆/课程认牌进来都退回原页；直链兜底牌库 -->
      <button class="back btn-text" @click="goBack('/deck')">
        <AppIcon name="arrow" :size="16" style="transform: rotate(180deg)" />
        返回
      </button>
      <div class="img-wrap">
        <img v-if="cardUrl(card.id)" class="img" :src="cardUrl(card.id)" :class="{ reversed: orientation === 'reversed' }" alt="" />
        <div v-else class="img skeleton" />
      </div>
      <h1 class="name">{{ card.name }} <span class="name-en">{{ card.nameEn }}</span></h1>
      <p class="meta">
        {{ card.arcana === 'major' ? '大阿尔克那' : '小阿尔克那' }}
        <template v-if="card.element"> · {{ card.element }}</template>
        <template v-if="card.astro"> · {{ card.astro }}</template>
      </p>
    </header>

    <div class="orient">
      <button class="seg" :class="{ on: orientation === 'upright' }" @click="orientation = 'upright'">正位</button>
      <button class="seg" :class="{ on: orientation === 'reversed' }" @click="orientation = 'reversed'">逆位</button>
    </div>

    <section class="sec card">
      <h2 class="sec-title">关键词</h2>
      <div class="kw">
        <span v-for="k in card.keywords[orientation]" :key="k" class="tag-kw">{{ k }}</span>
      </div>
    </section>

    <section class="sec card">
      <h2 class="sec-title">牌意</h2>
      <p class="meaning">{{ card.meaning[orientation] }}</p>
    </section>

    <section v-if="card.domains" class="sec card">
      <h2 class="sec-title">四领域</h2>
      <div v-for="(d, key) in card.domains" :key="key" class="domain">
        <span class="domain-tag badge">{{ DOMAIN_LABEL[key] }}</span>
        <p class="domain-text">{{ d[orientation] }}</p>
      </div>
    </section>

    <section v-if="card.symbols" class="sec card">
      <h2 class="sec-title">牌面符号</h2>
      <p class="meaning">{{ card.symbols }}</p>
    </section>
  </div>

  <div v-else class="missing">
    <p>没找到这张牌。</p>
    <button class="btn-ghost" @click="goDeck()">返回牌库</button>
  </div>
</template>

<style scoped>
.detail {
  padding: var(--sp-3) 20px calc(40px + env(safe-area-inset-bottom, 0px));
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-left: 0;
  margin-bottom: 14px;
}

.img-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.img {
  width: 150px;
  border-radius: var(--radius-img);
  box-shadow: var(--shadow-card);
  transition: transform var(--t-mid) var(--ease-out);
}

.img.reversed {
  transform: rotate(180deg);
}

.name {
  font-size: var(--fs-title);
  text-align: center;
}

.name-en {
  font-size: var(--fs-note);
  color: var(--dim);
  font-weight: var(--w-medium);
}

.meta {
  text-align: center;
  font-size: var(--fs-note);
  color: var(--dim);
  margin-top: 6px;
}

.orient {
  display: flex;
  gap: 8px;
  margin: var(--sp-3) 0;
}

.seg {
  flex: 1;
  padding: 11px;
  border-radius: var(--radius-btn);
  background: var(--surface);
  border: 2px solid var(--line);
  border-bottom-width: 3px;
  color: var(--dim);
  font-size: var(--fs-body);
  font-weight: var(--w-strong);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.seg.on {
  border-color: var(--gold-deep);
  background: var(--gold-soft);
  color: var(--gold-text);
}

.sec {
  padding: var(--sp-2);
  margin-bottom: 14px;
}

.sec-title {
  font-size: var(--fs-head);
  margin-bottom: 10px;
}

.kw {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.meaning {
  font-size: var(--fs-body);
  line-height: 1.9;
}

.domain {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.domain-tag {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
}

.domain-text {
  font-size: var(--fs-note);
  line-height: 1.8;
  color: var(--dim);
}

.missing {
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--dim);
}
</style>
