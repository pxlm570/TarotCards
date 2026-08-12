<script setup>
// 记录详情页（M3 Task 2）：只读牌阵全景 + 每位置解读 + 日记编辑 + 删除。
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import cardsData from '../data/cards.json'
import spreadsData from '../data/spreads.json'
import { useJournalStore } from '../stores/journal.js'
import { useDeck } from '../lib/use-deck.js'
import SpreadCanvas from '../components/SpreadCanvas.vue'
import AppIcon from '../components/AppIcon.vue'
import { tap, toast, success } from '../lib/feedback.js'

const route = useRoute()
const router = useRouter()
const journal = useJournalStore()
const { cardUrl } = useDeck()

const cardById = new Map(cardsData.map((c) => [c.id, c]))
const reading = computed(() => journal.getById(route.params.readingId))
const spread = computed(() => spreadsData.find((s) => s.id === reading.value?.spreadId))
const note = ref('')
let loaded = false

if (reading.value && !loaded) {
  note.value = reading.value.note
  loaded = true
}

const items = computed(() =>
  (reading.value?.cards ?? []).map((d) => {
    const card = cardById.get(d.cardId)
    const pos = spread.value?.positions.find((p) => p.key === d.positionKey)
    return {
      ...d,
      card,
      position: pos,
      meaning: card ? card.meaning[d.reversed ? 'reversed' : 'upright'] : ''
    }
  })
)

function saveNote() {
  journal.saveNote(reading.value.id, note.value)
  reading.value.note = note.value
  success()
  toast('已保存', 'success')
}

function remove() {
  if (!window.confirm('确定删除这条记录吗？此操作不可恢复。')) return
  journal.remove(reading.value.id)
  toast('已删除')
  router.replace('/journal')
}
</script>

<template>
  <div class="detail">
    <header class="head">
      <button class="back btn-text" @click="router.back()">
        <AppIcon name="arrow" :size="16" style="transform: rotate(180deg)" />
        记录
      </button>
      <h1 class="title">{{ spread?.name ?? '占卜' }} · 详情</h1>
      <p v-if="reading?.question" class="question">「{{ reading.question }}」</p>
    </header>

    <div v-if="reading && spread" class="overview card">
      <SpreadCanvas
        :spread="spread"
        :cards="reading.cards"
        :revealed="null"
        readonly
        :portrait="spread.cardCount > 5"
        :card-width-pct="spread.cardCount > 5 ? 12 : 16"
      />
    </div>

    <section class="cards" v-if="items.length">
      <article v-for="(item, i) in items" :key="i" class="pos card">
        <div class="pos-head">
          <img v-if="cardUrl(item.cardId)" class="thumb" :src="cardUrl(item.cardId)" :class="{ reversed: item.reversed }" alt="" />
          <div class="pos-main">
            <p class="pos-label">{{ item.position?.label ?? '' }}</p>
            <p class="card-name">
              {{ item.card?.name ?? '' }}
              <span class="orientation badge" :class="{ 'badge-plain': item.reversed }">{{ item.reversed ? '逆位' : '正位' }}</span>
            </p>
          </div>
        </div>
        <p class="meaning">{{ item.meaning }}</p>
      </article>
    </section>

    <section class="note-area card">
      <h2 class="note-title"><AppIcon name="note" :size="18" /> 我的日记</h2>
      <textarea v-model="note" rows="4" class="note-input" placeholder="写下此刻的回顾与感悟……" />
      <button class="save btn-ghost btn-block" :disabled="!note.trim()" @click="saveNote">保存</button>
    </section>

    <button class="delete btn-text" @click="remove">
      <AppIcon name="journal" :size="15" />
      删除这条记录
    </button>
  </div>
</template>

<style scoped>
.detail {
  padding: var(--sp-3) 18px calc(40px + env(safe-area-inset-bottom, 0px));
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

.question {
  color: var(--dim);
  font-size: var(--fs-note);
  margin-top: 4px;
}

.overview {
  padding: 10px;
  margin: var(--sp-3) 0;
}

.pos {
  padding: 14px;
  margin-bottom: 12px;
}

.pos-head {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}

.thumb {
  width: 52px;
  aspect-ratio: 300 / 527;
  border-radius: var(--radius-img);
  box-shadow: var(--shadow-card);
}

.thumb.reversed {
  transform: rotate(180deg);
}

.pos-main {
  flex: 1;
}

.pos-label {
  font-size: 0.75rem;
  color: var(--dim);
}

.card-name {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
}

.orientation {
  font-size: 0.6875rem;
  margin-left: 6px;
}

.meaning {
  font-size: var(--fs-note);
  color: var(--dim);
  line-height: 1.8;
}

.note-area {
  padding: var(--sp-2);
  margin-top: var(--sp-3);
}

.note-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-head);
  margin-bottom: 10px;
}

.note-input {
  width: 100%;
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 12px;
  color: var(--ink);
  font-size: 1rem;
  line-height: 1.8;
  resize: none;
}

.save {
  margin-top: 10px;
}

.delete {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 24px auto;
  color: var(--dim);
}
</style>
