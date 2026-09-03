<script setup>
// 牌库 Tab：搜索/筛选 + 牌面库（可自由组合）+ 牌背库（独立选择，各用各的名字）。
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import cardsData from '../data/cards.json'
import CardGrid from '../components/CardGrid.vue'
import AppIcon from '../components/AppIcon.vue'
import { useDeck } from '../lib/use-deck.js'
import { listDecks, loadDeck, cardImageUrl, listBacks, standaloneBackUrl } from '../lib/deck-loader.js'
import { orderBacks, orderFaces } from '../lib/deck-order.js'
import { useProfileStore } from '../stores/profile.js'
import { tap, toast } from '../lib/feedback.js'

const router = useRouter()
const profile = useProfileStore()
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
    faces.value = orderFaces(items)
  })
  .catch(() => {})

// 牌背库（独立注册表，用牌背自己的名字；连胜解锁款带 unlock 门槛）
listBacks()
  .then((list) => {
    backs.value = list.map((b) => ({ id: b.id, name: b.name, url: standaloneBackUrl(b), unlock: b.unlock ?? 0 }))
  })
  .catch(() => {})

function isBackLocked(b) {
  return b.unlock > 0 && profile.maxStreak < b.unlock
}

// 展示顺序（2026-09-03 用户拍板）：已解锁排前、锁款靠右；随连胜变化即时重排
const orderedBacks = computed(() => orderBacks(backs.value, isBackLocked))

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

function goCollection() {
  tap()
  router.push('/collection')
}

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
  const b = backs.value.find((x) => x.id === id)
  if (b && isBackLocked(b)) {
    toast(`连续打卡 ${b.unlock} 天解锁`, 'info')
    return
  }
  switchBack(id)
  tap()
  toast('已切换牌背', 'success')
}
</script>

<template>
  <div class="deck">
    <header class="head">
      <div class="title-row">
        <h1 class="title">牌库</h1>
        <button class="collection-link" @click="goCollection">
          <AppIcon name="star" :size="15" />
          收藏馆
        </button>
      </div>
      <div class="search">
        <input v-model="keyword" class="search-input" type="search" placeholder="搜牌名 / 英文名 / 关键词" />
      </div>
    </header>

    <!-- 牌背库：独立选择 -->
    <section v-if="backs.length" class="lib">
      <p class="lib-title">牌背 · 点选切换（自由组合）</p>
      <div class="lib-row">
        <button
          v-for="b in orderedBacks"
          :key="b.id"
          class="lib-item"
          :class="{ on: backId === b.id, locked: isBackLocked(b) }"
          @click="pickBack(b.id)"
        >
          <span class="lib-back-wrap">
            <img v-if="b.url" class="lib-back" :src="b.url" :alt="b.name" />
            <div v-else class="lib-back skeleton" />
            <span v-if="isBackLocked(b)" class="lib-lock"><AppIcon name="lock" :size="16" /></span>
          </span>
          <span class="lib-name">{{ b.name }}</span>
          <span v-if="isBackLocked(b)" class="lib-lock-hint">{{ b.unlock }} 天解锁</span>
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

/* 标题行：标题左、收藏馆入口右；不用 float（会被下方 relative 的搜索框盖住点不到） */
.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 收藏馆入口：与标题同行，金色行动位 */
.collection-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  padding: 6px 12px;
  font-size: var(--fs-note);
  color: var(--gold-text);
  background: none;
  border: 1px solid var(--gold-deep);
  border-radius: var(--radius-pill);
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
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

.lib-item.locked {
  opacity: 0.55;
}

.lib-back-wrap {
  position: relative;
  display: block;
}

.lib-lock {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  border-radius: var(--radius-img);
  color: #fff;
}

.lib-lock-hint {
  font-size: 0.625rem;
  color: var(--coral);
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
