<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import spreads from '../data/spreads.json'
import { useReadingStore } from '../stores/reading.js'
import { PHASE_ROUTE } from '../router/index.js'

const router = useRouter()
const reading = useReadingStore()

// Android 返回手势/误退出后，进行中的占卜仍在（store 或 sessionStorage）——
// 给出「继续占卜」入口，否则 standalone PWA 下没有任何途径回到动线
reading.hasActiveReading()
const activeReading = computed(() => reading.phase !== 'idle' && PHASE_ROUTE[reading.phase])

function resumeReading() {
  router.push(PHASE_ROUTE[reading.phase])
}

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 5) return '夜深了，让牌陪你静一静'
  if (h < 11) return '早安，今天想问点什么？'
  if (h < 14) return '午后小憩，抽一张牌吧'
  if (h < 19) return '傍晚好，回顾一下今天'
  return '晚上好，此刻适合占卜'
})

function startReading(spreadId) {
  if (activeReading.value && !window.confirm('有一局占卜正在进行，开始新的将丢弃它。确定吗？')) {
    return
  }
  reading.reset()
  router.push({ path: '/reading/breathe', query: { spread: spreadId } })
}
</script>

<template>
  <div class="home">
    <header class="home-header">
      <div>
        <h1 class="title">星语塔罗</h1>
        <p class="greeting">{{ greeting }}</p>
      </div>
      <router-link to="/welcome" class="help" aria-label="重看新手引导">?</router-link>
    </header>

    <button v-if="activeReading" class="resume" @click="resumeReading">
      <span>🌙 有一局{{ reading.spread?.name ?? '' }}占卜正在进行</span>
      <span class="resume-cta">继续 →</span>
    </button>

    <section class="spreads">
      <h2 class="section-title">选择牌阵</h2>
      <button v-for="spread in spreads" :key="spread.id" class="spread-card" @click="startReading(spread.id)">
        <div class="spread-info">
          <span class="spread-name">{{ spread.name }}</span>
          <span class="spread-count">{{ spread.cardCount }} 张牌</span>
        </div>
        <span class="badge" :class="{ advanced: spread.difficulty === '进阶' }">{{ spread.difficulty }}</span>
      </button>
    </section>

    <section class="learn-entry">
      <router-link to="/learn" class="learn-card">
        <span>🎓 从零学塔罗</span>
        <span class="learn-hint">7 章新手课程 · 敬请期待</span>
      </router-link>
    </section>
  </div>
</template>

<style scoped>
.home {
  padding: 24px 20px;
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 28px;
}

.title {
  font-size: 1.5rem;
  letter-spacing: 0.12em;
  color: var(--gold-bright);
  margin-bottom: 6px;
}

.greeting {
  color: var(--moon-dim);
  font-size: 0.9375rem;
}

.help {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--moon-dim);
  color: var(--moon-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-size: 0.9375rem;
  /* 视觉 32px、命中区扩到 44px */
  box-sizing: content-box;
  padding: 6px;
  margin: -6px;
  background-clip: content-box;
}

.resume {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--gold);
  border-radius: var(--radius-card);
  background: rgba(184, 145, 47, 0.1);
  color: var(--gold-bright);
  padding: 14px 16px;
  margin-bottom: 20px;
  font-family: var(--sans);
  font-size: 0.9375rem;
  cursor: pointer;
}

.resume-cta {
  flex-shrink: 0;
}

.section-title {
  font-size: 1.0625rem;
  margin-bottom: 14px;
}

.spread-card {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-card);
  border: none;
  border-radius: var(--radius-card);
  padding: 18px 16px;
  margin-bottom: 12px;
  cursor: pointer;
  color: var(--moon);
  font-family: var(--sans);
  transition: transform 0.15s;
}

.spread-card:active {
  transform: scale(0.98);
}

.spread-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.spread-name {
  font-size: 1rem;
}

.spread-count {
  font-size: 0.8125rem;
  color: var(--moon-dim);
}

.badge {
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(184, 145, 47, 0.16);
  color: var(--gold-bright);
}

.badge.advanced {
  background: rgba(127, 119, 221, 0.18);
  color: var(--violet);
}

.learn-entry {
  margin-top: 28px;
}

.learn-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--bg-inset);
  border-radius: var(--radius-card);
  padding: 16px;
  text-decoration: none;
  color: var(--moon);
}

.learn-hint {
  font-size: 0.8125rem;
  color: var(--moon-dim);
}
</style>
