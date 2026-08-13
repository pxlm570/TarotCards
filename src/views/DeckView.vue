<script setup>
// 牌库 Tab：搜索/筛选 + 牌面库（可自由组合）+ 牌背库（独立选择，各用各的名字）。
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import cardsData from '../data/cards.json'
import CardGrid from '../components/CardGrid.vue'
import AppIcon from '../components/AppIcon.vue'
import { useDeck } from '../lib/use-deck.js'
import { listDecks, loadDeck, cardImageUrl, listBacks, standaloneBackUrl } from '../lib/deck-loader.js'
import { tap, toast } from '../lib/feedback.js'

const router = useRouter()
const { faceId, backId, switchFace, switchBack } = useDeck()

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
const faces = ref([]) // [{id, name, thumb}] 牌面
const backs = ref([]) // [{id, name, url}] 牌背

// 牌面库
listDecks()
  .then(async (ids) => {
    const items = []
    for (const id of ids) {
      try {
        const m = await loadDeck(id)
        items.push({ id, name: m.name, thumb: cardImageUrl(m, 'major-00') })
      } catch {
        items.push({ id, name: id, thumb: '' })
      }
    }
    faces.value = items
  })
  .catch(() => {})

// 牌背库（独立注册表，用牌背自己的名字）
listBacks()
  .then((list) => {
    backs.value = list.map((b) => ({ id: b.id, name: b.name, url: standaloneBackUrl(b) }))
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

function pickFace(id) {
  switchFace(id)
  tap()
  toast('已切换牌面', 'success')
}

function pickBack(id) {
  switchBack(id)
  tap()
  toast('已切换牌背', 'success')
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

    <!-- 牌背库：独立选择 -->
    <section v-if="backs.length" class="lib">
      <p class="lib-title">牌背 · 点选切换（自由组合）</p>
      <div class="lib-row">
        <button
          v-for="b in backs"
          :key="b.id"
          class="lib-item"
          :class="{ on: backId === b.id }"
          @click="pickBack(b.id)"
        >
          <img v-if="b.url" class="lib-back" :src="b.url" :alt="b.name" />
          <div v-else class="lib-back skeleton" />
          <span class="lib-name">{{ b.name }}</span>
        </button>
      </div>
    </section>

    <!-- 牌面库：独立选择 -->
    <section v-if="faces.length > 1" class="lib">
      <p class="lib-title">牌面 · 点选切换</p>
      <div class="lib-row">
        <button
          v-for="f in faces"
          :key="f.id"
          class="lib-item"
          :class="{ on: faceId === f.id }"
          @click="pickFace(f.id)"
        >
          <img v-if="f.thumb" class="lib-face" :src="f.thumb" :alt="f.name" />
          <div v-else class="lib-face skeleton" />
          <span class="lib-name">{{ f.name }}</span>
        </button>
      </div>
    </section>

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

.lib {
  margin-bottom: 14px;
}

.lib-title {
  font-size: var(--fs-note);
  color: var(--dim);
  margin-bottom: 8px;
}

.lib-row {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.lib-item {
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

.lib-item.on {
  border-color: var(--gold-deep);
  background: var(--gold-soft);
}

.lib-back,
.lib-face {
  width: 84px;
  aspect-ratio: 300 / 527;
  border-radius: var(--radius-img);
  object-fit: cover;
  box-shadow: var(--shadow-card);
}

.lib-name {
  font-size: 0.6875rem;
  color: var(--dim);
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.count {
  font-size: var(--fs-note);
  color: var(--dim);
  margin-bottom: 12px;
}
</style>
