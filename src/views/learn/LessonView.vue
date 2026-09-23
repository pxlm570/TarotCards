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
import { useBack } from '../../composables/use-back.js'
import { useLearningStore } from '../../stores/learning.js'
import { chapters as courseData } from '../../lib/learning-path.js'

const route = useRoute()
const router = useRouter()
const goBack = useBack()
const learning = useLearningStore()

const chapterId = computed(() => route.params.chapterId)
const lessonId = computed(() => route.params.lessonId)

// 按 id 加载章节数据（文件名 chapter-<序号>.json，序号来自 index 的 order）
const chapterMeta = computed(() => chapters.find((c) => c.id === chapterId.value))
const chapterData = computed(() => courseData.find((c) => c.id === chapterId.value))
const lesson = computed(() => chapterData.value?.lessons.find((l) => l.id === lessonId.value))

// 解锁门（评审 2026-09-06）：深链不校验解锁时，完成动作会炸在 completeLesson（三个完成
// 入口都无捕获），闪卡课更会卡死在最后一张。锁定态复用 ChapterView 的文案。
const locked = computed(() => !!chapterMeta.value && !!lesson.value && !learning.unlocked.includes(chapterId.value))

const title = computed(() => lesson.value?.title ?? '未找到课程')
const completed = computed(() => !!learning.progress[chapterId.value]?.[lessonId.value])
const following = computed(() => {
  const list = chapterData.value?.lessons ?? []
  const next = list[list.findIndex((l) => l.id === lessonId.value) + 1]
  if (next) return { title: next.title, path: `/learn/${chapterId.value}/${next.id}` }
  const chapter = courseData.find((c) => c.order === chapterData.value?.order + 1)
  if (chapter && learning.unlocked.includes(chapter.id)) return { title: chapter.title, path: `/learn/${chapter.id}/${chapter.lessons[0].id}` }
  return null
})

</script>

<template>
  <div class="lesson">
    <header class="head">
      <button class="back btn-text" @click="goBack(`/learn/${chapterId}`)">
        <AppIcon name="arrow" :size="16" style="transform: rotate(180deg)" />
        返回章节
      </button>
      <h1 class="title">{{ title }}</h1>
    </header>

    <div v-if="!chapterMeta || !lesson" class="missing card">
      <p>找不到这一课。</p>
      <button class="btn-ghost" @click="goBack(`/learn/${chapterId}`)">返回章节</button>
    </div>
    <div v-else-if="locked" class="locked card">
      <AppIcon name="lock" :size="22" />
      <p>完成前一章所有课程后解锁。</p>
      <button class="btn-ghost" @click="goBack(`/learn/${chapterId}`)">返回章节</button>
    </div>
    <template v-else>
      <ArticleLesson
        v-if="lesson.type === 'article'"
        :key="lesson.id"
        :blocks="lesson.blocks"
        :chapter-id="chapterId"
        :lesson-id="lessonId"
      />
      <FlashcardLesson
        v-else-if="lesson.type === 'flashcards'"
        :key="lesson.id"
        :chapter-id="chapterId"
        :lesson-id="lessonId"
        :card-ids="lesson.cardIds"
      />
      <QuizLesson
        v-else-if="lesson.type === 'quiz'"
        :key="lesson.id"
        :chapter-id="chapterId"
        :lesson-id="lessonId"
        :questions="lesson.questions"
      />
      <PracticeLesson
        v-else-if="lesson.type === 'practice'"
        :key="lesson.id"
        :chapter-id="chapterId"
        :lesson-id="lessonId"
        :spread-id="lesson.spreadId"
        :task="lesson.task"
      />
      <section v-if="completed" class="next-lesson card">
        <p>本课已完成，进度已记下</p>
        <button v-if="following" class="btn-solid btn-block" @click="router.replace(following.path)">下一课 · {{ following.title }}<AppIcon name="arrow" :size="16" /></button>
        <button v-else class="btn-solid btn-block" @click="router.replace('/learn')">回到学习之旅</button>
      </section>
    </template>
  </div>
</template>

<style scoped>
.next-lesson { margin-top: 20px; padding: 16px; display: grid; gap: 12px; }
.next-lesson p { font-size: var(--fs-note); color: var(--dim); }
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

.missing,
.locked {
  padding: var(--sp-3);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--dim);
}
</style>
