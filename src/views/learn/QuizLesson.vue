<script setup>
// 随堂测验：逐题单选，选完即显示解析；全部作答后判分，≥80% 通过（可重考）。
import { ref, computed } from 'vue'
import { useLearningStore } from '../../stores/learning.js'
import { tap, success } from '../../lib/feedback.js'

const props = defineProps({
  chapterId: { type: String, required: true },
  lessonId: { type: String, required: true },
  questions: { type: Array, required: true }
})

const learning = useLearningStore()
const answers = ref({})
const submitted = ref(false)
const passed = ref(false)

const allAnswered = computed(() => Object.keys(answers.value).length === props.questions.length)

const correct = computed(() => props.questions.reduce((n, q, i) => n + (answers.value[i] === q.answer ? 1 : 0), 0))
const percent = computed(() => (props.questions.length ? Math.round((correct.value / props.questions.length) * 100) : 0))

function pick(qIndex, optIndex) {
  if (submitted.value) return
  answers.value = { ...answers.value, [qIndex]: optIndex }
  tap()
}

function submit() {
  if (!allAnswered.value) return
  submitted.value = true
  passed.value = percent.value >= 80
  if (passed.value) {
    learning.completeLesson(props.chapterId, props.lessonId)
    success()
  }
}

function retake() {
  answers.value = {}
  submitted.value = false
  passed.value = false
}
</script>

<template>
  <div class="quiz">
    <div v-for="(q, qi) in questions" :key="qi" class="q card">
      <p class="q-text">{{ qi + 1 }}. {{ q.q }}</p>
      <div class="opts">
        <button
          v-for="(opt, oi) in q.options"
          :key="oi"
          class="opt"
          :class="{
            sel: answers[qi] === oi,
            right: submitted && oi === q.answer,
            wrong: submitted && answers[qi] === oi && oi !== q.answer
          }"
          @click="pick(qi, oi)"
        >
          {{ opt }}
        </button>
      </div>
      <p v-if="submitted && answers[qi] !== undefined" class="explain">解析：{{ q.explain }}</p>
    </div>

    <div class="foot">
      <button v-if="!submitted" class="btn-solid btn-block" :disabled="!allAnswered" @click="submit">
        查看结果
      </button>
      <div v-else class="result card" :class="{ pass: passed }">
        <p class="score">{{ correct }} / {{ questions.length }} · {{ percent }}%</p>
        <p class="verdict">{{ passed ? '通过！' : '还差一点，再试一次' }}</p>
        <button v-if="!passed" class="btn-ghost btn-block" @click="retake">重新作答</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quiz {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.q {
  padding: var(--sp-2);
}

.q-text {
  font-size: var(--fs-body);
  font-weight: var(--w-strong);
  line-height: 1.7;
  margin-bottom: 12px;
}

.opts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.opt {
  text-align: left;
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 2px solid var(--line);
  border-bottom-width: 3px;
  color: var(--ink);
  font-size: var(--fs-body);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color var(--t-fast), background var(--t-fast), transform var(--t-press);
}

.opt:active {
  transform: translateY(2px);
  border-bottom-width: 2px;
}

.opt.sel {
  border-color: var(--gold-deep);
  background: var(--gold-soft);
}

.opt.right {
  border-color: var(--gold-deep);
  background: var(--gold-soft);
}

.opt.wrong {
  border-color: var(--coral);
  background: rgba(240, 101, 90, 0.12);
}

.explain {
  margin-top: 10px;
  font-size: var(--fs-note);
  color: var(--dim);
  line-height: 1.7;
}

.foot {
  margin-top: 6px;
}

.result {
  padding: var(--sp-2);
  text-align: center;
}

.score {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
}

.verdict {
  font-size: var(--fs-note);
  color: var(--dim);
  margin: 6px 0 12px;
}
</style>
