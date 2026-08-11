<script setup>
// 课内页：按 lesson.type 分发到对应渲染组件。
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import chapters from '../../data/courses/index.json'
import ArticleLesson from './ArticleLesson.vue'
import FlashcardLesson from './FlashcardLesson.vue'
import QuizLesson from './QuizLesson.vue'
import PracticeLesson from './PracticeLesson.vue'
import AppIcon from '../../components/AppIcon.vue'

const route = useRoute()
const router = useRouter()

const chapterId = route.params.chapterId
const lessonId = route.params.lessonId

// 按 id 加载章节数据（静态 import 映射）
const CHAPTER_MODULES = import.meta.glob('../../data/courses/chapter-*.json', { eager: true })
const chapterMeta = chapters.find((c) => c.id === chapterId)
const chapterData = CHAPTER_MODULES[`../../data/courses/chapter-${chapterId}.json`]?.default
const lesson = chapterData?.lessons?.find((l) => l.id === lessonId)

const title = computed(() => lesson?.title ?? '未找到课程')

function openCard(cardId) {
  router.push(`/deck/${cardId}`)
}
</script>

<template>
  <div class="lesson">
    <header class="head">
      <button class="back btn-text" @click="router.back()">
        <AppIcon name="arrow" :size="16" style="transform: rotate(180deg)" />
        返回章节
      </button>
      <h1 class="title">{{ title }}</h1>
    </header>

    <ArticleLesson
      v-if="lesson?.type === 'article'"
      :blocks="lesson.blocks"
      @open-card="openCard"
    />
    <FlashcardLesson
      v-else-if="lesson?.type === 'flashcards'"
      :chapter-id="chapterId"
      :lesson-id="lessonId"
      :card-ids="lesson.cardIds"
    />
    <QuizLesson
      v-else-if="lesson?.type === 'quiz'"
      :chapter-id="chapterId"
      :lesson-id="lessonId"
      :questions="lesson.questions"
    />
    <PracticeLesson
      v-else-if="lesson?.type === 'practice'"
      :chapter-id="chapterId"
      :lesson-id="lessonId"
      :spread-id="lesson.spreadId"
      :task="lesson.task"
    />
    <div v-else class="missing card">
      <p>找不到这一课。</p>
      <button class="btn-ghost" @click="router.back()">返回章节</button>
    </div>
  </div>
</template>

<style scoped>
.lesson {
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

.missing {
  padding: var(--sp-3);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--dim);
}
</style>
