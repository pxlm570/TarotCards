<script setup>
import { ref, computed, nextTick } from 'vue'
import { useLearningStore } from '../../stores/learning.js'
import activities from '../../data/lesson-activities.json'
import { articleSteps } from '../../lib/learning-path.js'
import LessonIllustration from '../../components/LessonIllustration.vue'
import AppIcon from '../../components/AppIcon.vue'
import { tap, success } from '../../lib/feedback.js'

const props = defineProps({ blocks: { type: Array, required: true }, chapterId: String, lessonId: String })
const learning = useLearningStore()
const activity = computed(() => activities[props.lessonId])
const steps = computed(() => articleSteps(props.blocks))
const index = ref(0)
const selected = ref(null)
const checked = ref(false)
const finished = ref(false)
const titleEl = ref(null)
const isPractice = computed(() => index.value === steps.value.length + 1)
const total = computed(() => steps.value.length + 2)
const current = computed(() => steps.value[index.value - 1])
const correct = computed(() => selected.value === activity.value?.question.answer)
const progress = computed(() => finished.value ? 100 : (index.value / total.value) * 100)
const shownCards = computed(() => {
  const cards = activity.value?.cards ?? []
  return index.value === 0 || isPractice.value ? cards : current.value?.cards ?? []
})
async function focusStep() {
  await nextTick()
  titleEl.value?.focus({ preventScroll: true })
  titleEl.value?.scrollIntoView?.({ block: 'start', behavior: 'auto' })
}
function next() { if (isPractice.value) return; index.value++; tap(); focusStep() }
function back() { index.value = Math.max(0, index.value - 1); checked.value = false; focusStep() }
function choose(i) { if (checked.value && correct.value) return; selected.value = i; checked.value = false; tap() }
function check() { if (selected.value == null) return; checked.value = true; if (correct.value) success() }
function finish() {
  if (!checked.value || !correct.value || finished.value) return
  learning.completeLesson(props.chapterId, props.lessonId)
  finished.value = true
  success()
  focusStep()
}
function replay() { index.value = 0; selected.value = null; checked.value = false; finished.value = false; focusStep() }
</script>

<template>
  <div class="article-journey">
    <div class="step-meta"><span>{{ finished ? '本节已完成' : `第 ${index + 1} / ${total} 步` }}</span><span>{{ isPractice ? '动手试一试' : '一次一个小发现' }}</span></div>
    <div class="lesson-progress" role="progressbar" aria-label="本课进度" :aria-valuenow="Math.round(progress)" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: progress + '%' }" /></div>
    <section v-if="finished" class="finish card">
      <AppIcon name="star" :size="42" />
      <h2 ref="titleEl" tabindex="-1">又看懂了一点</h2>
      <p>你完成了看图、理解与练习。下次遇到这些牌，试着先回想画面。</p>
      <LessonIllustration v-if="activity" :cards="activity.cards.slice(0, 2)" compact />
      <button class="btn-ghost" @click="replay">再学一遍</button>
    </section>
    <section v-else class="step-card card">
      <p class="eyebrow">{{ index === 0 ? '先观察画面' : isPractice ? '把刚学的用起来' : '看图 · 理解' }}</p>
      <h2 ref="titleEl" tabindex="-1">{{ index === 0 ? '先看一眼，你发现了什么？' : isPractice ? activity.question.prompt : current?.title }}</h2>
      <LessonIllustration v-if="shownCards.length" :cards="shownCards" />
      <p v-if="index === 0" class="body">{{ activity?.observe }}</p>
      <template v-else-if="!isPractice">
        <p v-if="current?.block.type === 'paragraph'" class="body">{{ current.block.text }}</p>
        <ul v-else-if="current?.block.type === 'list'" class="points"><li v-for="point in current.block.items" :key="point"><AppIcon name="check" :size="18" /><span>{{ point }}</span></li></ul>
      </template>
      <template v-else>
        <div class="choices" role="group" aria-label="选择答案">
          <button v-for="(option, i) in activity.question.options" :key="i" class="choice card-press" :class="{ selected: selected === i }" :aria-pressed="selected === i" :disabled="checked && correct" @click="choose(i)"><span class="choice-index">{{ i + 1 }}</span>{{ option }}</button>
        </div>
        <div v-if="checked" class="answer-feedback" role="status"><b>{{ correct ? '答对了，记住这个线索' : '再想一想，你可以重选' }}</b><p>{{ activity.question.explanation }}</p></div>
      </template>
      <div class="step-actions">
        <button v-if="index > 0" class="btn-ghost" @click="back">上一步</button>
        <button v-if="!isPractice" class="btn-solid" @click="next">{{ index === 0 ? '开始探索' : index === steps.length ? '练一练' : '继续' }}<AppIcon name="arrow" :size="17" /></button>
        <button v-else-if="checked && correct" class="btn-solid" @click="finish">完成本课<AppIcon name="check" :size="17" /></button>
        <button v-else class="btn-solid" :disabled="selected === null || checked" @click="check">检查答案</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.article-journey { display: grid; gap: var(--sp-2); }
.step-meta { display: flex; justify-content: space-between; color: var(--dim); font-size: var(--fs-note); }
.lesson-progress { height: 10px; background: var(--sunk); border-radius: var(--radius-pill); overflow: hidden; }
.lesson-progress span { display: block; height: 100%; border-radius: inherit; background: var(--gold); transition: width var(--t-fast); }
.step-card { padding: var(--sp-2); display: grid; gap: var(--sp-2); }
.eyebrow { color: var(--dim); font-size: var(--fs-note); font-weight: var(--w-strong); }
h2 { font-size: var(--fs-head); line-height: 1.6; scroll-margin-top: 20px; }
h2:focus { outline: none; }
.body { font-size: var(--fs-body); line-height: 1.9; }
.points { display: grid; gap: 14px; }
.points li { display: flex; align-items: flex-start; gap: 10px; }
.points svg { flex-shrink: 0; margin-top: 4px; color: var(--gold-text); }
.step-actions { display: flex; gap: 10px; padding-top: 8px; }
.step-actions .btn-solid { flex: 1; }
.choices { display: grid; gap: 10px; }
.choice { display: flex; align-items: center; gap: 12px; padding: 14px; width: 100%; font-size: var(--fs-body); line-height: 1.6; }
.choice.selected { border-color: var(--gold-deep); background: var(--gold-soft); }
.choice:disabled { cursor: default; }
.choice-index { display: grid; place-items: center; flex-shrink: 0; width: 27px; height: 27px; border: 1px solid var(--line); border-radius: var(--radius-sm); font-size: var(--fs-note); }
.answer-feedback { padding: 16px; border-radius: var(--radius-btn); background: var(--sunk); font-size: var(--fs-body); }
.answer-feedback b { color: var(--gold-text); }
.answer-feedback p { margin-top: 8px; }
.finish { padding: 28px 20px; display: grid; justify-items: center; gap: 18px; text-align: center; }
.finish > svg { color: var(--gold-text); }
.finish p { color: var(--dim); }
@media (prefers-reduced-motion: reduce) { .lesson-progress span { transition: none; } }
[data-motion="reduced"] .lesson-progress span { transition: none; }
</style>
