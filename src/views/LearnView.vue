<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { chapters, nextLesson, CHAPTER_CARDS, LESSON_LABELS } from '../lib/learning-path.js'
import { useLearningStore } from '../stores/learning.js'
import LessonIllustration from '../components/LessonIllustration.vue'
import AppIcon from '../components/AppIcon.vue'
import { tap } from '../lib/feedback.js'
const router = useRouter()
const learning = useLearningStore()
const next = computed(() => nextLesson(learning.progress, learning.unlocked))
const totalPct = computed(() => Math.round(learning.totalDoneCount / learning.totalLessonCount * 100))
const dueCount = computed(() => learning.dueFlashcards().length)
const currentArt = computed(() => [{ cardId: CHAPTER_CARDS[(next.value?.chapter.order ?? 1) - 1] }])
function openChapter(id) { if (learning.unlocked.includes(id)) { tap(); router.push(`/learn/${id}`) } }
</script>
<template>
  <div class="learn">
    <header class="head"><div><p class="eyebrow">每天一点，看懂牌里的故事</p><h1>学习之旅</h1></div><span class="badge">{{ learning.totalDoneCount }} / {{ learning.totalLessonCount }} 课</span></header>
    <section v-if="next" class="continue-card card">
      <div class="continue-copy"><span class="badge">{{ learning.totalDoneCount ? '接着上次，继续出发' : '你的第一站' }}</span><p class="chapter-kicker">第 {{ next.chapter.order }} 章 · {{ next.chapter.title }}</p><h2>{{ next.lesson.title }}</h2><p class="hint">{{ LESSON_LABELS[next.lesson.type] }} · 按自己的节奏来</p></div>
      <LessonIllustration :cards="currentArt" compact />
      <button class="btn-solid btn-block continue-btn" @click="router.push(next.path)">{{ learning.totalDoneCount ? '继续学习' : '开始第一课' }}<AppIcon name="arrow" :size="18" /></button>
    </section>
    <section v-else class="graduated card"><AppIcon name="star" :size="34" /><h2>{{ learning.graduated ? '愚人之旅，走到世界' : '这一站已完成' }}</h2><p>回看熟悉的牌，也会发现新的线索。</p><button class="btn-solid" @click="router.push('/learn/review?all=1')">复习全副牌</button></section>
    <div class="journey-meta"><h2>七站成长小径</h2><span>{{ totalPct }}% 已完成</span></div>
    <div class="overall-track" role="progressbar" aria-label="全部课程进度" :aria-valuenow="totalPct" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: totalPct + '%' }" /></div>
    <section class="path" aria-label="章节路径">
      <div v-for="(chapter, i) in chapters" :key="chapter.id" class="path-stop" :class="{ locked: !learning.unlocked.includes(chapter.id), current: next?.chapter.id === chapter.id }">
        <div class="path-node"><AppIcon v-if="learning.isChapterComplete(chapter.id)" name="check" :size="22" /><AppIcon v-else-if="!learning.unlocked.includes(chapter.id)" name="lock" :size="20" /><span v-else>{{ chapter.order }}</span></div>
        <button class="chapter card-press" :disabled="!learning.unlocked.includes(chapter.id)" @click="openChapter(chapter.id)">
          <div class="chapter-copy"><span class="chapter-number">第 {{ chapter.order }} 站<span v-if="next?.chapter.id === chapter.id"> · 正在探索</span></span><h3>{{ chapter.title }}</h3><p>{{ chapter.intro }}</p><span class="lesson-count">{{ learning.unlocked.includes(chapter.id) ? `${learning.chapterDoneCount(chapter.id)} / ${chapter.lessons.length} 课` : '完成前一章后解锁' }}</span></div>
          <LessonIllustration :cards="[{ cardId: CHAPTER_CARDS[i] }]" compact />
        </button>
      </div>
    </section>
    <section class="practice-hub"><h2>换种方式练一练</h2><button class="review card-press" @click="router.push('/learn/review')"><AppIcon name="deck" :size="24" /><span><b>今日复习</b><small>{{ dueCount ? `${dueCount} 张卡牌等你回想` : '先认识新牌，再回来温习' }}</small></span><AppIcon name="arrow" :size="16" /></button><button class="review card-press" @click="router.push('/learn/challenge')"><AppIcon name="sparkle" :size="24" /><span><b>每日三题</b><small>用小挑战唤醒记忆 · 每日首次 +10 XP</small></span><AppIcon name="arrow" :size="16" /></button><button class="browse btn-text" @click="router.push('/deck')">自由探索七十八张牌 <AppIcon name="arrow" :size="16" /></button></section>
  </div>
</template>
<style scoped>
.learn { padding: var(--sp-3) 20px var(--sp-4); }
.head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 24px; }
.head h1 { font-size: var(--fs-title); margin-top: 5px; }
.eyebrow, .hint, .chapter-kicker { font-size: var(--fs-note); color: var(--dim); }
.head .badge { flex-shrink: 0; }
.continue-card { padding: 20px; display: grid; grid-template-columns: 1fr 72px; gap: 16px; align-items: center; }
.continue-copy { min-width: 0; }
.continue-copy .badge { white-space: normal; }
.chapter-kicker { margin: 12px 0 4px; }
.continue-card h2 { font-size: 21px; margin-bottom: 8px; }
.continue-btn { grid-column: 1 / -1; }
.journey-meta { display: flex; justify-content: space-between; align-items: center; margin: 30px 0 12px; }
.journey-meta h2, .practice-hub h2 { font-size: var(--fs-head); }
.journey-meta span { color: var(--dim); font-size: var(--fs-note); }
.overall-track { height: 8px; border-radius: var(--radius-pill); background: var(--sunk); overflow: hidden; }
.overall-track span { display: block; height: 100%; background: var(--gold); border-radius: inherit; }
.path { position: relative; margin: 24px 0; }
.path::before { content: ''; position: absolute; top: 30px; bottom: 70px; width: 3px; left: 22px; background: var(--line); }
.path-stop { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; position: relative; }
.path-node { display: grid; place-items: center; width: 46px; height: 46px; flex-shrink: 0; border-radius: 50%; border: 2px solid var(--line); border-bottom-width: 5px; background: var(--surface); font-size: 18px; font-weight: var(--w-title); }
.current .path-node { background: var(--gold); border-color: var(--gold-deep); color: var(--on-gold); }
.chapter { min-width: 0; flex: 1; padding: 16px; display: grid; grid-template-columns: 1fr 48px; align-items: center; gap: 12px; }
.chapter-copy { min-width: 0; }
.current .chapter { border-color: var(--gold-deep); }
.chapter-number { color: var(--dim); font-size: 11px; }
.chapter h3 { font-size: var(--fs-body); margin: 5px 0; }
.chapter p { color: var(--dim); font-size: 12px; line-height: 1.65; }
.lesson-count { display: block; margin-top: 10px; font-size: 12px; color: var(--gold-text); font-weight: var(--w-strong); }
.locked .chapter { background: var(--sunk); cursor: default; }
.locked .lesson-count, .locked .path-node { color: var(--dim); }
.locked :deep(img) { filter: grayscale(1); opacity: .65; }
.practice-hub { padding-top: 8px; }
.review { display: flex; align-items: center; gap: 14px; width: 100%; padding: 16px; margin-top: 14px; }
.review span { flex: 1; }
.review small { display: block; color: var(--dim); font-size: 12px; margin-top: 4px; }
.browse { display: flex; gap: 10px; justify-content: center; width: 100%; margin-top: 12px; }
.graduated { padding: 24px; display: grid; justify-items: center; gap: 16px; text-align: center; }
.graduated > svg { color: var(--gold-text); }
@media (max-width: 360px) { .learn { padding-inline: 12px; }.chapter { padding: 12px; grid-template-columns: 1fr 38px; }.path-stop { gap: 8px; } }
</style>
