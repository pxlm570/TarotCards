<script setup>
// 时间线条目（M3 Task 2 + v1.1 Task 13）：牌阵名 + 问题摘要 + 牌面缩略横排 + 每日一抽标记；
// 支持触摸左滑露出删除按钮（二次确认后删除，走 journal store）。
import { ref } from 'vue'
import spreadsData from '../data/spreads.json'
import { useDeck } from '../lib/use-deck.js'
import { useJournalStore } from '../stores/journal.js'
import { toast, tap } from '../lib/feedback.js'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  reading: { type: Object, required: true }
})

const emit = defineEmits(['open'])
const journal = useJournalStore()
const { cardUrl } = useDeck()
const spreadName = spreadsData.find((s) => s.id === props.reading.spreadId)?.name ?? '占卜'

// ---- 左滑删除 ----
const offset = ref(0) // 卡片内容 translateX
let startX = 0
let tracking = false

function onTouchStart(e) {
  startX = e.touches[0].clientX
  tracking = true
}

function onTouchMove(e) {
  if (!tracking) return
  const dx = e.touches[0].clientX - startX
  offset.value = Math.max(-92, Math.min(0, dx))
}

function onTouchEnd() {
  tracking = false
  offset.value = offset.value < -46 ? -92 : 0
}

function open() {
  offset.value = 0 // 点卡片先收回左滑
  emit('open', props.reading.id)
}

function del() {
  if (!window.confirm('确定删除这条记录吗？此操作不可恢复。')) return
  tap()
  journal.remove(props.reading.id)
  toast('已删除')
}
</script>

<template>
  <div class="timeline-wrap" :class="{ open: offset < 0 }">
    <!-- 藏在右侧的删除按钮 -->
    <button class="del" aria-label="删除" @click="del"><AppIcon name="journal" :size="18" /></button>

    <!-- 卡片内容（左滑位移） -->
    <button
      class="timeline-item card-press"
      :style="{ transform: `translateX(${offset}px)` }"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @click="open"
    >
      <div class="row-top">
        <span class="spread badge">{{ spreadName }}</span>
        <span v-if="reading.isDaily" class="daily"><AppIcon name="moon" :size="13" /> 每日一抽</span>
      </div>
      <p v-if="reading.question" class="question">{{ reading.question }}</p>
      <div class="thumbs">
        <img
          v-for="(c, i) in reading.cards.slice(0, 5)"
          :key="i"
          class="thumb"
          :class="{ reversed: c.reversed }"
          :src="cardUrl(c.cardId)"
          :alt="c.cardId"
          loading="lazy"
        />
      </div>
    </button>
  </div>
</template>

<style scoped>
.timeline-wrap {
  position: relative;
  margin-bottom: 12px;
  overflow: hidden;
  border-radius: var(--radius-card);
}

/* 删除按钮藏在右侧 */
.del {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 92px;
  border: none;
  background: var(--coral);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.timeline-item {
  position: relative;
  width: 100%;
  text-align: left;
  padding: 14px;
  border-radius: var(--radius-card);
  background: var(--surface);
  transition: transform var(--t-fast) var(--ease-out);
  touch-action: pan-y; /* 横向交给左滑，纵向可滚动 */
}

.row-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.spread {
  font-size: 0.6875rem;
}

.daily {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.6875rem;
  color: var(--dim);
}

.question {
  font-size: var(--fs-body);
  font-weight: var(--w-strong);
  margin-bottom: 10px;
  line-height: 1.6;
}

.thumbs {
  display: flex;
  gap: 6px;
}

.thumb {
  width: 40px;
  aspect-ratio: 300 / 527;
  border-radius: var(--radius-img);
  object-fit: cover;
  box-shadow: var(--shadow-card);
}

.thumb.reversed {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .timeline-item {
    transition: none;
  }
}
</style>
