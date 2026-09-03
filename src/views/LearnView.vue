<script setup>
// 学习 Tab：章节列表（金勾/进行中/锁定）、总进度环、今日复习入口、毕业卡。
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import chapters from '../data/courses/index.json'
import { useLearningStore } from '../stores/learning.js'
import ProgressRing from '../components/ProgressRing.vue'
import AppIcon from '../components/AppIcon.vue'
import { tap } from '../lib/feedback.js'

const router = useRouter()
const learning = useLearningStore()

const totalPct = computed(() =>
  learning.totalLessonCount ? Math.round((learning.totalDoneCount / learning.totalLessonCount) * 100) : 0
)
const dueCount = computed(() => learning.dueFlashcards().length)

function openChapter(id) {
  if (!learning.unlocked.includes(id)) return
  tap()
  router.push(`/learn/${id}`)
}

// 认识牌面入口：入门学习从逐张点开牌库开始（牌库页每张牌可点看牌义，用户不知道要靠这里提示）
function goDeck() {
  tap()
  router.push('/deck')
}
</script>

<template>
  <div class="learn">
    <header class="head">
      <h1 class="title">学习</h1>
      <div class="ring-block">
        <ProgressRing :value="totalPct / 100" :size="64" :stroke="7" />
        <div class="ring-num">{{ totalPct }}%</div>
      </div>
    </header>

    <div v-if="learning.graduated" class="grad card">
      <AppIcon name="star" :size="26" />
      <p class="grad-title">已毕业 · 世界</p>
      <p class="grad-text">你已走完愚人之旅。全库卡牌复习已解锁，长期维护你的记忆。</p>
    </div>

    <button class="review card-press" @click="router.push('/learn/review')">
      <AppIcon name="deck" :size="22" />
      <span class="review-main">
        <b>今日复习</b>
        <span class="review-sub">{{ dueCount }} 张卡牌待复习</span>
      </span>
      <span class="review-cta">
        去复习 <AppIcon name="arrow" :size="15" />
      </span>
    </button>

    <!-- 认识牌面：用牌库页当入门教材（每张牌可点开看牌义），不另做一套学习卡 -->
    <button class="review card-press" @click="goDeck">
      <AppIcon name="eye" :size="22" />
      <span class="review-main">
        <b>认识牌面</b>
        <span class="review-sub">点开任意一张牌，了解它的牌义与启示</span>
      </span>
      <span class="review-cta">
        去牌库 <AppIcon name="arrow" :size="15" />
      </span>
    </button>

    <!-- 每日挑战：低调可选，不做也不影响 -->
    <button class="challenge-link" @click="router.push('/learn/challenge')">
      <AppIcon name="sparkle" :size="15" />
      每日挑战 · 3 题（+10 XP）
    </button>

    <section class="chapters">
      <h2 class="section-title">章节</h2>
      <button
        v-for="(c, i) in chapters"
        :key="c.id"
        class="chapter card-press stagger-item"
        :class="{ locked: !learning.unlocked.includes(c.id) }"
        :style="{ '--i': i }"
        @click="openChapter(c.id)"
      >
        <span class="ch-n">{{ c.order }}</span>
        <span class="ch-main">
          <span class="ch-title">{{ c.title }}</span>
          <span class="ch-intro">{{ c.intro }}</span>
        </span>
        <span class="ch-state">
          <template v-if="!learning.unlocked.includes(c.id)">
            <AppIcon name="lock" :size="16" />
          </template>
          <template v-else-if="learning.isChapterComplete(c.id)">
            <AppIcon name="check" :size="18" class="ok" />
          </template>
          <template v-else>
            <span class="in-progress">{{ learning.chapterDoneCount(c.id) }} 课</span>
          </template>
        </span>
      </button>
    </section>
  </div>
</template>

<style scoped>
.learn {
  padding: var(--sp-3) 20px var(--sp-4);
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--sp-3);
}

.title {
  font-size: var(--fs-title);
}

.ring-block {
  position: relative;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-num {
  position: absolute;
  font-size: 0.8125rem;
  font-weight: var(--w-title);
  color: var(--gold-text);
}

.grad {
  padding: var(--sp-2);
  margin-bottom: var(--sp-3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  color: var(--gold-text);
}

.grad-title {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
}

.grad-text {
  font-size: var(--fs-note);
  color: var(--dim);
  line-height: 1.7;
}

.review {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 16px;
  margin-bottom: var(--sp-3);
  color: var(--gold-text);
}

.review-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.review-main b {
  color: var(--ink);
  font-size: var(--fs-head);
}

.review-sub {
  font-size: var(--fs-note);
  color: var(--dim);
}

.review-cta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-note);
  font-weight: var(--w-strong);
}

.challenge-link {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  margin-bottom: var(--sp-3);
  background: none;
  border: 2px dashed var(--line);
  border-radius: var(--radius-card);
  color: var(--dim);
  font-size: var(--fs-note);
  font-weight: var(--w-strong);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.section-title {
  font-size: var(--fs-head);
  margin-bottom: 12px;
}

.chapter {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 10px;
}

.chapter.locked {
  opacity: 0.55;
}

.ch-n {
  min-width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gold-soft);
  color: var(--gold-text);
  font-weight: var(--w-title);
  font-size: 0.9375rem;
}

.chapter.locked .ch-n {
  background: var(--sunk);
  color: var(--dim);
}

.ch-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ch-title {
  font-size: var(--fs-body);
  font-weight: var(--w-strong);
}

.ch-intro {
  font-size: var(--fs-note);
  color: var(--dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ch-state {
  color: var(--dim);
  flex-shrink: 0;
}

.ch-state .ok {
  color: var(--gold-text);
}

.in-progress {
  font-size: var(--fs-note);
  color: var(--gold-text);
  font-weight: var(--w-strong);
}
</style>
