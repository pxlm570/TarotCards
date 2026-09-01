<script setup>
// 章节页：列出本课 lesson，已完成的打勾；第 5 章完成后引导开启逆位。
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import chapters from '../../data/courses/index.json'
import { useLearningStore } from '../../stores/learning.js'
import AppIcon from '../../components/AppIcon.vue'
import TutorFab from '../../components/TutorFab.vue'
import { useBack } from '../../composables/use-back.js'

const route = useRoute()
const router = useRouter()
const learning = useLearningStore()
const goBack = useBack()

const chapterId = route.params.chapterId
const chapterMeta = chapters.find((c) => c.id === chapterId)
const CHAPTER_MODULES = import.meta.glob('../../data/courses/chapter-*.json', { eager: true })
// 文件名是 chapter-<两位序号>.json（如 chapter-01.json），序号来自 index 的 order
const chapterFile = chapterMeta ? `../../data/courses/chapter-${String(chapterMeta.order).padStart(2, '0')}.json` : null
const chapterData = chapterFile ? CHAPTER_MODULES[chapterFile]?.default : undefined

const unlocked = computed(() => learning.unlocked.includes(chapterId))
const chapterDone = computed(() => learning.isChapterComplete(chapterId))

const lessons = computed(() => chapterData?.lessons ?? [])
const doneCount = computed(() => learning.chapterDoneCount(chapterId))
const totalCount = computed(() => lessons.value.length)

// 第 5 章完成 → 引导开启逆位
const showReversalGuide = computed(() => chapterId === 'ch-05' && chapterDone.value)

function openLesson(id) {
  if (!unlocked.value) return
  router.push(`/learn/${chapterId}/${id}`)
}

// 供学习助教：把本章图文正文拼成一段摘要
const chapterContent = computed(() => {
  const out = []
  for (const l of lessons.value) {
    if (l.type === 'article') {
      for (const b of l.blocks) {
        if (b.type === 'heading' || b.type === 'paragraph') out.push(b.text)
      }
    }
  }
  return out.join(' ').slice(0, 1200)
})
</script>

<template>
  <div class="chapter">
    <header class="head">
      <button class="back btn-text" @click="goBack('/learn')">
        <AppIcon name="arrow" :size="16" style="transform: rotate(180deg)" />
        学习
      </button>
      <h1 class="title">{{ chapterMeta?.title }}</h1>
      <p class="intro">{{ chapterMeta?.intro }}</p>
      <p class="meta" v-if="unlocked">已完成 {{ doneCount }} / {{ totalCount }}</p>
    </header>

    <div v-if="!unlocked" class="locked card">
      <AppIcon name="lock" :size="22" />
      <p>完成前一章所有课程后解锁。</p>
    </div>

    <template v-else>
      <div v-if="showReversalGuide" class="guide card">
        <p class="guide-title">你已经掌握了正逆位</p>
        <p class="guide-text">去设置里开启逆位，让解读更完整。</p>
        <button class="btn-solid btn-block" @click="router.push('/profile')">去开启逆位</button>
      </div>

      <div class="lesson-list">
        <button
          v-for="(l, i) in lessons"
          :key="l.id"
          class="lesson-item card-press stagger-item"
          :style="{ '--i': i }"
          @click="openLesson(l.id)"
        >
          <span class="item-icon">
            <AppIcon
              :name="l.type === 'article' ? 'learn' : l.type === 'flashcards' ? 'deck' : l.type === 'quiz' ? 'sparkle' : 'pen'"
              :size="20"
            />
          </span>
          <span class="item-main">
            <span class="item-title">{{ l.title }}</span>
            <span class="item-type">{{ { article: '图文', flashcards: '闪卡', quiz: '测验', practice: '实战' }[l.type] }}</span>
          </span>
          <AppIcon v-if="learning.progress[chapterId]?.[l.id]" class="done-mark" name="check" :size="18" />
        </button>
      </div>
    </template>

    <TutorFab v-if="unlocked" :chapter-title="chapterMeta?.title ?? ''" :content="chapterContent" />
  </div>
</template>

<style scoped>
.chapter {
  padding: var(--sp-3) 20px calc(40px + env(safe-area-inset-bottom, 0px));
}

.head {
  margin-bottom: var(--sp-3);
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-left: 0;
  margin-bottom: 8px;
}

.title {
  font-size: var(--fs-title);
}

.intro {
  color: var(--dim);
  font-size: var(--fs-note);
  margin-top: 4px;
}

.meta {
  margin-top: 10px;
  font-size: var(--fs-note);
  color: var(--gold-text);
  font-weight: var(--w-strong);
}

.locked {
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--dim);
}

.guide {
  padding: var(--sp-2);
  margin-bottom: var(--sp-3);
}

.guide-title {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  margin-bottom: 6px;
}

.guide-text {
  font-size: var(--fs-note);
  color: var(--dim);
  margin-bottom: 12px;
}

.lesson-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lesson-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
}

.item-icon {
  color: var(--gold-text);
  display: flex;
}

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-title {
  font-size: var(--fs-body);
  font-weight: var(--w-strong);
}

.item-type {
  font-size: 0.6875rem;
  color: var(--dim);
}

.done-mark {
  color: var(--gold-text);
  flex-shrink: 0;
}
</style>
