<script setup>
// 随堂测验（#6 改版）：闯关式逐题作答，四题型（单选/多选/看图认牌/正逆判断），
// 答错可无限重试当前题（答对才推进）——趣味向、无压力，完成即打勾。
import { ref, computed } from 'vue'
import { useLearningStore } from '../../stores/learning.js'
import { useProfileStore } from '../../stores/profile.js'
import { useDeck } from '../../lib/use-deck.js'
import { tap, success } from '../../lib/feedback.js'

const props = defineProps({
  chapterId: { type: String, required: true },
  lessonId: { type: String, required: true },
  questions: { type: Array, required: true }
})

const learning = useLearningStore()
const profile = useProfileStore()
const { cardUrl } = useDeck()

const index = ref(0)
const multiSel = ref([]) // 多选已勾下标
const wrongMsg = ref('') // 答错的解析提示
const done = ref(false)

const current = computed(() => props.questions[index.value])
const type = computed(() => current.value?.type ?? 'single')

function isCorrect() {
  const q = current.value
  if (q.type === 'multi') {
    const ans = Array.isArray(q.answer) ? q.answer : []
    return multiSel.value.length === ans.length && ans.every((a) => multiSel.value.includes(a))
  }
  return true // single/image/orientation 由选中即时判
}

// 单选类：点击即判
function pick(oi) {
  const q = current.value
  if (q.type === 'multi') {
    multiSel.value = multiSel.value.includes(oi)
      ? multiSel.value.filter((x) => x !== oi)
      : [...multiSel.value, oi]
    return
  }
  tap()
  if (oi === q.answer) {
    advance()
  } else {
    wrongMsg.value = q.explain
  }
}

function confirmMulti() {
  if (multiSel.value.length === 0) return
  if (isCorrect()) advance()
  else wrongMsg.value = current.value.explain
}

function advance() {
  success()
  if (index.value + 1 >= props.questions.length) {
    finish()
  } else {
    index.value++
    multiSel.value = []
    wrongMsg.value = ''
  }
}

function finish() {
  const firstTime = !learning.progress[props.chapterId]?.[props.lessonId]
  done.value = true
  learning.completeLesson(props.chapterId, props.lessonId)
  if (firstTime) profile.addXp(30) // 首次通过一章测验（重玩不再发）
}

function retry() {
  wrongMsg.value = ''
  multiSel.value = []
  if (current.value?.type === 'multi') return
  // 单选类重试：重置（因每次点选已即时判，重试即再点）
  wrongMsg.value = ''
}

const isDone = computed(() => !!learning.progress[props.chapterId]?.[props.lessonId])
</script>

<template>
  <div class="quiz">
    <div class="bar">
      <span class="bar-num">第 {{ index + 1 }} / {{ questions.length }} 题</span>
      <div class="track"><div class="fill" :style="{ width: (index / questions.length) * 100 + '%' }" /></div>
    </div>

    <div v-if="done" class="done card">
      <p class="done-title">本课测验完成</p>
      <p class="done-hint">答错的题已经弄懂，随时可以再回来玩。</p>
    </div>

    <div v-else-if="current" class="q card" :key="index">
      <!-- 看图认牌 -->
      <template v-if="type === 'image'">
        <p class="q-text">这张牌是哪张？</p>
        <div class="q-img-wrap">
          <img v-if="cardUrl(current.cardId)" class="q-img" :src="cardUrl(current.cardId)" alt="" />
          <!-- manifest 未就位的骨架：看图题没图=盲猜，必须占位等图 -->
          <div v-else class="q-img skeleton" />
        </div>
      </template>
      <!-- 正逆判断 -->
      <template v-else-if="type === 'orientation'">
        <p class="q-text">{{ current.q }}</p>
        <div class="q-img-wrap">
          <img v-if="cardUrl(current.cardId)" class="q-img" :src="cardUrl(current.cardId)" alt="" />
          <div v-else class="q-img skeleton" />
        </div>
      </template>
      <p v-else class="q-text">{{ current.q }}</p>

      <div class="opts">
        <button
          v-for="(opt, oi) in current.options"
          :key="oi"
          class="opt"
          :class="{ sel: type === 'multi' && multiSel.includes(oi), right: wrongMsg && oi === current.answer && type !== 'multi' }"
          @click="pick(oi)"
        >
          {{ opt }}
        </button>
      </div>

      <p v-if="wrongMsg" class="explain">提示：{{ wrongMsg }}</p>

      <div v-if="type === 'multi'" class="multi-actions">
        <button class="btn-solid btn-block" :disabled="multiSel.length === 0" @click="confirmMulti">确认</button>
      </div>

      <button v-if="wrongMsg && type !== 'multi'" class="btn-ghost btn-block retry" @click="retry">再试一次</button>
    </div>
  </div>
</template>

<style scoped>
.quiz {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bar-num {
  font-size: var(--fs-note);
  color: var(--dim);
  flex-shrink: 0;
}

.track {
  flex: 1;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--sunk);
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--gold);
  transition: width var(--t-mid) var(--ease-out);
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

.q-img-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.q-img {
  width: 130px;
  aspect-ratio: 300 / 527;
  border-radius: var(--radius-img);
  object-fit: cover;
  box-shadow: var(--shadow-card);
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

.explain {
  margin-top: 10px;
  font-size: var(--fs-note);
  color: var(--coral);
  line-height: 1.7;
}

.multi-actions {
  margin-top: 12px;
}

.retry {
  margin-top: 12px;
}

.done {
  padding: var(--sp-3);
  text-align: center;
}

.done-title {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  color: var(--gold-text);
  margin-bottom: 6px;
}

.done-hint {
  font-size: var(--fs-note);
  color: var(--dim);
}
</style>
