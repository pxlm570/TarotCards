<script setup>
// 牌详情弹层（M2 Task 5）：InterpretationView 与 CardDetailView 共用。
// props.reversed 用于从解读页进入时高亮当前正逆位（仅高亮定位，不筛选内容）。
import { useDeck } from '../lib/use-deck.js'
import AppIcon from './AppIcon.vue'

defineProps({
  card: { type: Object, required: true },
  reversed: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])
const { cardUrl } = useDeck()
</script>

<template>
  <div class="modal" @click.self="emit('close')">
    <div class="modal-card">
      <img v-if="cardUrl(card.id)" class="modal-img" :src="cardUrl(card.id)" :class="{ reversed }" alt="" />
      <h3 class="modal-name">{{ card.name }} {{ card.nameEn }}</h3>
      <p class="modal-meta">
        {{ card.arcana === 'major' ? '大阿尔克那' : '小阿尔克那' }}
        <template v-if="card.element"> · {{ card.element }}</template>
        <template v-if="card.astro"> · {{ card.astro }}</template>
      </p>
      <div class="modal-sec">
        <h4>正位</h4>
        <p>{{ card.meaning.upright }}</p>
      </div>
      <div class="modal-sec">
        <h4>逆位</h4>
        <p>{{ card.meaning.reversed }}</p>
      </div>
      <div class="modal-sec" v-if="card.domains">
        <h4>四领域</h4>
        <div v-for="(d, key) in card.domains" :key="key" class="domain-row">
          <span class="domain-tag badge">{{ { love: '感情', career: '事业', wealth: '财运', study: '学业' }[key] }}</span>
          <span class="domain-text">
            <b>正</b>{{ d.upright }}
            <b>逆</b>{{ d.reversed }}
          </span>
        </div>
      </div>
      <div v-if="card.symbols" class="modal-sec">
        <h4>牌面符号</h4>
        <p>{{ card.symbols }}</p>
      </div>
      <button class="modal-close btn-ghost btn-block" @click="emit('close')">
        <AppIcon name="chevron" :size="16" style="transform: rotate(180deg)" />
        关闭
      </button>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 30;
  animation: fade-in var(--t-fast) var(--ease-out);
}

.modal-card {
  width: 100%;
  max-width: 480px;
  max-height: 86vh;
  overflow-y: auto;
  background: var(--surface);
  border: 2px solid var(--line);
  border-bottom: none;
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  padding: var(--sp-3) 20px calc(var(--sp-3) + env(safe-area-inset-bottom, 0px));
  text-align: center;
  box-shadow: var(--shadow-pop);
  animation: sheet-up var(--t-fast) var(--ease-out);
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}

@keyframes sheet-up {
  from {
    transform: translateY(24px);
  }
}

.modal-img {
  width: 112px;
  border-radius: var(--radius-img);
  margin-bottom: 12px;
  box-shadow: var(--shadow-card);
}

.modal-img.reversed {
  transform: rotate(180deg);
}

.modal-name {
  font-size: 1.125rem;
  margin-bottom: 4px;
}

.modal-meta {
  font-size: var(--fs-note);
  color: var(--dim);
  margin-bottom: var(--sp-2);
}

.modal-sec {
  text-align: left;
  margin-bottom: 14px;
}

.modal-sec h4 {
  font-size: var(--fs-note);
  font-weight: var(--w-strong);
  color: var(--gold-text);
  margin-bottom: 6px;
}

.modal-sec p {
  font-size: var(--fs-body);
  line-height: 1.9;
}

.domain-row {
  display: flex;
  gap: 8px;
  font-size: var(--fs-note);
  line-height: 1.8;
  margin-bottom: 8px;
  color: var(--dim);
  text-align: left;
}

.domain-tag {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 1px;
}

.domain-text b {
  color: var(--ink);
  margin: 0 3px;
}

.modal-close {
  margin-top: var(--sp-1);
}

@media (prefers-reduced-motion: reduce) {
  .modal,
  .modal-card {
    animation: none;
  }
}
</style>
