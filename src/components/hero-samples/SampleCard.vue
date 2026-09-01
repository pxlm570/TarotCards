<script setup>
// 方案二样张「今日之牌」：一张 190px 大牌作首屏主角（3D 微倾 + 高光扫过），
// 已抽翻成牌面 + 今日指引；仪表盘内容下沉。
import { computed } from 'vue'
import AppIcon from '../AppIcon.vue'
import SampleBlocks from './SampleBlocks.vue'
import { useDeck } from '../../lib/use-deck.js'
import { tap, toast } from '../../lib/feedback.js'

defineProps({
  drawn: { type: Boolean, default: false },
  greeting: { type: String, default: '' }
})

const { backUrl, cardUrl } = useDeck()
const faceUrl = computed(() => cardUrl('major-17'))

function demoDraw() {
  tap()
  toast('样张预览 · 定稿后这里翻开每日一抽')
}
</script>

<template>
  <div class="page cardp">
    <header class="head">
      <h1 class="brand">星语<em>塔罗</em></h1>
      <AppIcon name="help" :size="22" />
    </header>
    <p class="greet">{{ greeting }}</p>

    <section class="hero">
      <button type="button" class="big-card" :class="{ drawn }" aria-label="每日一抽" @click="demoDraw">
        <span class="card-clip">
          <img v-if="drawn ? faceUrl : backUrl()" :src="drawn ? faceUrl : backUrl()" alt="每日一抽" />
          <span v-else class="ph" />
          <span v-if="!drawn" class="shine" aria-hidden="true" />
        </span>
        <span class="streak-badge"><b>6</b><i>天连胜</i></span>
      </button>
      <p class="cap">
        <b>{{ drawn ? '星辰 · 今日已抽' : '每日一抽' }}</b>
        <span>{{ drawn ? '轻触回看今天的指引' : '轻触翻开今天的牌' }}</span>
      </p>
      <p v-if="drawn" class="quote">「希望与新生正在靠近——把今天当作一张白纸来画。」</p>
    </section>

    <SampleBlocks :drawn="drawn" :face-url="faceUrl" />
  </div>
</template>

<style scoped>
.cardp {
  padding: var(--sp-3) 20px 110px;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--dim);
}

.brand {
  font-family: var(--serif);
  font-size: 1.375rem;
  font-weight: var(--w-title);
  color: var(--ink);
}

.brand em {
  font-style: normal;
  color: var(--gold-text);
}

.greet {
  margin: 4px 0 0;
  font-size: var(--fs-body);
  color: var(--dim);
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 18px 0 var(--sp-3);
}

.big-card {
  position: relative;
  width: 192px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transform: perspective(720px) rotateY(-7deg) rotateX(2deg);
  transition: transform var(--t-slow) var(--ease-out);
}

.big-card.drawn {
  transform: none;
}

.big-card:active {
  transform: perspective(720px) rotateY(-7deg) rotateX(2deg) scale(0.97);
}

.big-card.drawn:active {
  transform: scale(0.97);
}

.card-clip {
  display: block;
  position: relative;
  width: 100%;
  aspect-ratio: 500 / 878;
  border-radius: var(--radius-img);
  overflow: hidden;
  background: var(--sunk);
  box-shadow: var(--shadow-pop);
}

.big-card img,
.ph {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 32%, rgba(255, 255, 255, 0.2) 46%, transparent 60%);
  background-size: 260% 100%;
  animation: sweep 4.4s ease-in-out infinite;
}

@keyframes sweep {
  0% { background-position: 130% 0; }
  55%, 100% { background-position: -60% 0; }
}

.streak-badge {
  position: absolute;
  top: -12px;
  right: -14px;
  display: flex;
  align-items: baseline;
  gap: 3px;
  background: var(--gold);
  color: var(--on-gold);
  border-radius: var(--radius-pill);
  padding: 4px 10px;
  box-shadow: var(--shadow-card);
  white-space: nowrap;
}

.streak-badge b {
  font-size: 1rem;
  font-weight: var(--w-title);
  line-height: 1;
}

.streak-badge i {
  font-style: normal;
  font-size: 0.625rem;
}

.cap {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  text-align: center;
}

.cap b {
  font-size: var(--fs-head);
  font-weight: var(--w-strong);
  color: var(--gold-text);
}

.cap span {
  font-size: var(--fs-note);
  color: var(--dim);
}

.quote {
  margin-top: 10px;
  padding: 0 12px;
  font-size: var(--fs-note);
  color: var(--dim);
  text-align: center;
  line-height: 1.7;
}

@media (prefers-reduced-motion: reduce) {
  .shine { animation: none; }
}

[data-motion="reduced"] .shine { animation: none; }
</style>
