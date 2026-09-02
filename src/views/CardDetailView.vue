<script setup>
// 牌详情页（M2 Task 5）：大牌面、关键词、正逆位切换、四领域、元素星象、符号解析。
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import cardsData from '../data/cards.json'
import { useDeck } from '../lib/use-deck.js'
import AppIcon from '../components/AppIcon.vue'
import { useBack } from '../composables/use-back.js'
import { useEscClose } from '../composables/use-esc-close.js'
import { tap } from '../lib/feedback.js'

const route = useRoute()
const { cardUrl } = useDeck()
const goBack = useBack()

const card = computed(() => cardsData.find((c) => c.id === route.params.cardId))
const orientation = ref('upright')

// 大图灯箱：正逆位旋转状态同步；点遮罩任意处 / 右上角 × / Esc 关闭
const zoomOpen = ref(false)
function openZoom() {
  tap()
  zoomOpen.value = true
}
useEscClose(() => {
  zoomOpen.value = false
})

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
        <button class="img-btn" aria-label="查看大图" @click="openZoom">
          <img v-if="cardUrl(card.id)" class="img" :src="cardUrl(card.id)" :class="{ reversed: orientation === 'reversed' }" alt="" />
          <div v-else class="img skeleton" />
        </button>
        <span v-if="cardUrl(card.id)" class="img-hint"><AppIcon name="zoom" :size="13" /> 点按查看大图</span>
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

    <!-- 大图灯箱：挂在视口层，点任意处关闭 -->
    <Transition name="zoom-fade">
      <div v-if="zoomOpen && cardUrl(card.id)" class="lightbox" @click="zoomOpen = false">
        <img class="lightbox-img" :class="{ reversed: orientation === 'reversed' }" :src="cardUrl(card.id)" :alt="card.name" />
        <button class="lightbox-close" aria-label="关闭大图"><AppIcon name="x" :size="20" /></button>
      </div>
    </Transition>
  </div>

  <div v-else class="missing">
    <p>没找到这张牌。</p>
    <button class="btn-ghost" @click="goBack('/deck')">返回牌库</button>
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
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.img-btn {
  display: block;
  padding: 0;
  background: none;
  border: none;
  cursor: zoom-in;
  -webkit-tap-highlight-color: transparent;
}

.img {
  display: block;
  width: 150px;
  border-radius: var(--radius-img);
  box-shadow: var(--shadow-card);
  transition: transform var(--t-mid) var(--ease-out);
}

.img.reversed {
  transform: rotate(180deg);
}

.img-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-note);
  color: var(--dim);
}

/* 大图灯箱：压过 TabBar（z-10），暗底看图 */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(4, 7, 14, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.lightbox-img {
  max-width: min(92vw, 480px);
  max-height: 82vh;
  border-radius: var(--radius-img);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
}

.lightbox-img.reversed {
  transform: rotate(180deg);
}

.lightbox-close {
  position: absolute;
  top: calc(12px + env(safe-area-inset-top, 0px));
  right: 14px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border: none;
  border-radius: var(--radius-pill);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.zoom-fade-enter-active,
.zoom-fade-leave-active {
  transition: opacity var(--t-fast) var(--ease-out);
}

.zoom-fade-enter-from,
.zoom-fade-leave-to {
  opacity: 0;
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
