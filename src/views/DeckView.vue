<script setup>
// 牌库 Tab（M2 Task 5）：筛选 + 搜索 + 皮肤切换 + 网格。
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import cardsData from '../data/cards.json'
import CardGrid from '../components/CardGrid.vue'
import AppIcon from '../components/AppIcon.vue'
import { useDeck } from '../lib/use-deck.js'
import { listDecks, loadDeck, backImageUrl } from '../lib/deck-loader.js'
import { tap, toast } from '../lib/feedback.js'

const router = useRouter()
const { deckId, switchDeck } = useDeck()

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'major', label: '大阿尔克那' },
  { key: 'wands', label: '权杖' },
  { key: 'cups', label: '圣杯' },
  { key: 'swords', label: '宝剑' },
  { key: 'pentacles', label: '星币' }
]

const filter = ref('all')
const keyword = ref('')
const decks = ref([]) // [{id, name, backUrl}]

// 皮肤库：加载每个皮肤 manifest 的牌背缩略
listDecks()
  .then(async (ids) => {
    const items = []
    for (const id of ids) {
      try {
        const m = await loadDeck(id)
        items.push({ id, name: m.name, backUrl: backImageUrl(m) })
      } catch {
        items.push({ id, name: id, backUrl: '' })
      }
    }
    decks.value = items
  })
  .catch(() => {})

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return cardsData.filter((c) => {
    if (filter.value !== 'all' && c.arcana !== filter.value) return false
    if (!kw) return true
    return (
      c.name.includes(kw) ||
      c.nameEn.toLowerCase().includes(kw) ||
      [...(c.keywords.upright ?? []), ...(c.keywords.reversed ?? [])].some((k) => k.includes(kw))
    )
  })
})

function pickFilter(key) {
  filter.value = key
  tap()
}

function switchSkin(id) {
  switchDeck(id)
  tap()
  toast('已切换牌组', 'success')
}
</script>

<template>
  <div class="deck">
    <header class="head">
      <h1 class="title">牌库</h1>
      <div class="search">
        <input v-model="keyword" class="search-input" type="search" placeholder="搜牌名 / 英文名 / 关键词" />
      </div>
    </header>

    <div class="toolbar">
      <div class="chips">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          class="chip"
          :class="{ on: filter === f.key }"
          @click="pickFilter(f.key)"
        >
          {{ f.label }}
        </button>
      </div>
      <div v-if="decks.length > 1" class="skinlib">
        <p class="skinlib-title">皮肤库 · 点选切换</p>
        <div class="skinlib-row">
          <button
            v-for="d in decks"
            :key="d.id"
            class="skin-item"
            :class="{ on: deckId === d.id }"
            @click="switchSkin(d.id)"
          >
            <img v-if="d.backUrl" class="skin-back" :src="d.backUrl" :alt="d.name" />
            <div v-else class="skin-back skeleton" />
            <span class="skin-name">{{ d.name }}</span>
          </button>
        </div>
      </div>
    </div>

    <p class="count">共 {{ filtered.length }} 张</p>
    <CardGrid :cards="filtered" @select="(c) => router.push(`/deck/${c.id}`)" />
  </div>
</template>

<style scoped>
.deck {
  padding: var(--sp-3) 20px var(--sp-4);
}

.head {
  margin-bottom: var(--sp-3);
}

.title {
  font-size: var(--fs-title);
  margin-bottom: 12px;
}

.search {
  position: relative;
}

.search-input {
  width: 100%;
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: var(--radius-pill);
  padding: 10px 16px;
  color: var(--ink);
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: var(--gold-deep);
}

.toolbar {
  margin-bottom: 14px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  padding: 8px 14px;
  font-size: 0.8125rem;
}

.skinlib {
  margin-top: 12px;
}

.skinlib-title {
  font-size: var(--fs-note);
  color: var(--dim);
  margin-bottom: 8px;
}

.skinlib-row {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.skin-item {
  flex: none;
  width: 84px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: none;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  padding: 4px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.skin-item.on {
  border-color: var(--gold-deep);
  background: var(--gold-soft);
}

.skin-back {
  width: 84px;
  aspect-ratio: 300 / 527;
  border-radius: var(--radius-img);
  object-fit: cover;
  box-shadow: var(--shadow-card);
}

.skin-name {
  font-size: 0.6875rem;
  color: var(--dim);
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  font-size: var(--fs-note);
  color: var(--dim);
  margin-bottom: 12px;
}
</style>
