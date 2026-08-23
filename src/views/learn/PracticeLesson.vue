<script setup>
// 实战课：说明任务 → 跳入占卜动线（用本课指定牌阵），完成解读后回来自动打勾。
import { useRouter } from 'vue-router'
import { useReadingStore } from '../../stores/reading.js'
import { useLearningStore } from '../../stores/learning.js'
import { setPracticePending } from '../../lib/practice.js'
import { tap, toast } from '../../lib/feedback.js'
import AppIcon from '../../components/AppIcon.vue'

const props = defineProps({
  chapterId: { type: String, required: true },
  lessonId: { type: String, required: true },
  spreadId: { type: String, required: true },
  task: { type: String, required: true }
})

const router = useRouter()
const reading = useReadingStore()
const learning = useLearningStore()

const isDone = () => !!learning.progress[props.chapterId]?.[props.lessonId]

function go() {
  if (reading.phase !== 'idle') {
    if (!window.confirm('有一局占卜正在进行，开始实战练习将放弃这一局，确定吗？')) return
    reading.reset()
  }
  setPracticePending(props.chapterId, props.lessonId)
  tap()
  router.push({ path: '/reading/question', query: { spread: props.spreadId } })
}
</script>

<template>
  <div class="practice">
    <div class="task card">
      <p class="task-label"><AppIcon name="pen" :size="15" /> 本课任务</p>
      <p class="task-text">{{ task }}</p>
    </div>

    <div v-if="isDone()" class="done card">
      <AppIcon name="check" :size="22" />
      <p>实战完成，本课已打勾。</p>
    </div>
    <button v-else class="btn-solid btn-block" @click="go">
      <AppIcon name="reading" :size="18" />
      去占卜（{{ spreadId === 'single' ? '单张' : spreadId === 'time-flow' ? '时间之流' : spreadId === 'celtic-cross' ? '凯尔特十字' : '指定牌阵' }}）
    </button>
    <p class="hint">完成占卜并看到解读后，这一课会自动标记为完成。</p>
  </div>
</template>

<style scoped>
.practice {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.task {
  padding: var(--sp-2);
}

.task-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-note);
  font-weight: var(--w-strong);
  color: var(--gold-text);
  margin-bottom: 10px;
}

.task-text {
  font-size: var(--fs-body);
  line-height: 1.9;
}

.done {
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--gold-text);
  font-weight: var(--w-strong);
}

.hint {
  font-size: var(--fs-note);
  color: var(--dim);
  text-align: center;
  line-height: 1.7;
}
</style>
