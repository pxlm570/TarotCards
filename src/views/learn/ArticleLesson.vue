<script setup>
// 图文课（M3 改版）：按知识点分卡片 + 「标记已学习」打勾（也修掉 article 无完成触发的 bug）。
import { computed } from 'vue'
import { useDeck } from '../../lib/use-deck.js'
import { useLearningStore } from '../../stores/learning.js'
import AppIcon from '../../components/AppIcon.vue'
import { tap, success, toast } from '../../lib/feedback.js'

const props = defineProps({
  blocks: { type: Array, required: true },
  chapterId: { type: String, required: true },
  lessonId: { type: String, required: true }
})

const emit = defineEmits(['openCard'])
const { cardUrl } = useDeck()
const learning = useLearningStore()

const isDone = computed(() => !!learning.progress[props.chapterId]?.[props.lessonId])

// 按 heading 把 blocks 分组成知识卡片
const cards = computed(() => {
  const out = []
  let cur = null
  for (const b of props.blocks) {
    if (b.type === 'heading') {
      cur = { title: b.text, blocks: [] }
      out.push(cur)
    } else if (cur) {
      cur.blocks.push(b)
    } else {
      // 首块非 heading：兜底成一张无标题卡
      cur = { title: '', blocks: [b] }
      out.push(cur)
    }
  }
  return out
})

function markLearned() {
  tap()
  learning.completeLesson(props.chapterId, props.lessonId)
  success()
  toast('已标记本节已学习', 'success')
}
</script>

<template>
  <div class="cards">
    <article v-for="(card, ci) in cards" :key="ci" class="kc card">
      <h2 v-if="card.title" class="kc-title">{{ card.title }}</h2>
      <template v-for="(b, bi) in card.blocks" :key="bi">
        <p v-if="b.type === 'paragraph'" class="kc-para">{{ b.text }}</p>
        <ul v-else-if="b.type === 'list'" class="kc-list">
          <li v-for="(it, j) in b.items" :key="j" class="kc-li">
            <AppIcon name="star" :size="13" />
            <span>{{ it }}</span>
          </li>
        </ul>
        <button v-else-if="b.type === 'card-ref'" class="card-ref" @click="tap(); emit('openCard', b.cardId)">
          <img v-if="cardUrl(b.cardId)" class="card-ref-img" :src="cardUrl(b.cardId)" alt="" />
          <span class="card-ref-label">点我看这张牌 <AppIcon name="arrow" :size="14" /></span>
        </button>
      </template>
    </article>

    <!-- 标记已学习：手动打勾 -->
    <button class="learned" :class="{ done: isDone }" :disabled="isDone" @click="markLearned">
      <span class="learned-dot"><AppIcon :name="isDone ? 'check' : 'pen'" :size="16" /></span>
      <span>{{ isDone ? '本节已学习' : '标记本节已学习' }}</span>
      <AppIcon v-if="isDone" class="learned-check" name="check" :size="18" />
    </button>
  </div>
</template>

<style scoped>
.cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.kc {
  padding: var(--sp-2);
}

.kc-title {
  font-size: var(--fs-head);
  margin-bottom: 10px;
}

.kc-para {
  font-size: var(--fs-body);
  color: var(--ink);
  line-height: 1.9;
  margin-bottom: 12px;
}

.kc-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.kc-li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: var(--fs-body);
  color: var(--ink);
  line-height: 1.7;
}

.kc-li :deep(.app-icon) {
  color: var(--gold-text);
  margin-top: 5px;
  flex-shrink: 0;
}

.card-ref {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  margin: 6px 0;
  background: var(--surface);
  border: 2px dashed var(--line);
  border-radius: var(--radius-card);
  color: var(--dim);
  font-size: var(--fs-note);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--t-press) var(--ease-out), border-color var(--t-press);
}

.card-ref:active {
  transform: scale(0.98);
  border-color: var(--gold-deep);
}

.card-ref-img {
  width: 84px;
  border-radius: var(--radius-img);
  box-shadow: var(--shadow-card);
}

.card-ref-label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--gold-text);
  font-weight: var(--w-medium);
}

/* 已学习按钮 */
.learned {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px;
  border-radius: var(--radius-card);
  background: var(--surface);
  border: 2px dashed var(--line);
  color: var(--dim);
  font-size: var(--fs-body);
  font-weight: var(--w-strong);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color var(--t-fast), background var(--t-fast), color var(--t-fast);
}

.learned.done {
  border: 2px solid var(--gold-deep);
  background: var(--gold-soft);
  color: var(--gold-text);
  cursor: default;
}

.learned-dot {
  color: var(--gold-text);
}
</style>
