<script setup>
// 牌面鉴赏收藏馆（v1.5 Task 8）：三块内容--
// ① 牌面收集墙：78 格，journal 聚合点亮 + 次数角标，点亮的牌直达大图鉴赏；
// ② 皮肤墙：decks 注册表展示（当前款金标）；
// ③ 牌背墙：backs 注册表 + 连胜解锁进度（锁定态与牌库页同一口径：profile.maxStreak）。
// 不加 TabBar 项（五项已满）：入口在「我的」与牌库页。
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import cardsData from '../data/cards.json'
import AppIcon from '../components/AppIcon.vue'
import FlowExit from '../components/FlowExit.vue'
import { useJournalStore } from '../stores/journal.js'
import { useProfileStore } from '../stores/profile.js'
import { collectionStats, collectedCount } from '../lib/collection-stats.js'
import { useDeck } from '../lib/use-deck.js'
import { listDecks, loadDeck, cardImageUrl, listBacks, standaloneBackUrl } from '../lib/deck-loader.js'
import { tap } from '../lib/feedback.js'

const router = useRouter()
const journal = useJournalStore()
const profile = useProfileStore()
const { faceId, cardUrl } = useDeck()

const stats = computed(() => collectionStats(journal.readings))
const litCount = computed(() => collectedCount(stats.value, cardsData))

const faces = ref([]) // [{id, name, thumb}]
const backs = ref([]) // [{id, name, url, unlock}]

onMounted(() => {
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
  listBacks()
    .then((list) => {
      backs.value = list.map((b) => ({ id: b.id, name: b.name, url: standaloneBackUrl(b), unlock: b.unlock ?? 0 }))
    })
    .catch(() => {})
})

function isBackLocked(b) {
  return b.unlock > 0 && profile.maxStreak < b.unlock
}

function openCard(card) {
  if (!stats.value[card.id]?.count) return // 未点亮的牌锁定，鉴赏是收集的动力
  tap()
  router.push(`/deck/${card.id}`)
}
</script>

<template>
  <div class="collection">
    <FlowExit :confirm="false" :reset="false" label="返回" />

    <header class="head">
      <h1 class="title">收藏馆</h1>
      <p class="subtitle">每一次占卜都在点亮你的牌面收藏</p>
    </header>

    <!-- ① 牌面收集墙 -->
    <section class="block">
      <div class="block-head">
        <h2 class="block-title">牌面收集</h2>
        <span class="progress-badge">{{ litCount }} / {{ cardsData.length }}</span>
      </div>
      <div class="card-wall">
        <button
          v-for="card in cardsData"
          :key="card.id"
          class="wall-item"
          :class="{ lit: stats[card.id]?.count > 0 }"
          :aria-label="stats[card.id]?.count ? `${card.name}，出现过 ${stats[card.id].count} 次` : `${card.name}，尚未遇见`"
          @click="openCard(card)"
        >
          <img
            v-if="stats[card.id]?.count"
            :src="cardUrl(card.id)"
            :alt="card.name"
            loading="lazy"
            draggable="false"
          />
          <span v-else class="silhouette" aria-hidden="true">
            <AppIcon name="lock" :size="14" />
          </span>
          <span v-if="stats[card.id]?.count > 1" class="count-badge">{{ stats[card.id].count }}</span>
        </button>
      </div>
    </section>

    <!-- ② 皮肤墙 -->
    <section class="block">
      <div class="block-head">
        <h2 class="block-title">皮肤</h2>
      </div>
      <div class="lib-row">
        <div v-for="f in faces" :key="f.id" class="lib-item" :class="{ on: faceId === f.id }">
          <span class="lib-img-wrap">
            <img v-if="f.thumb" class="lib-img" :src="f.thumb" :alt="f.name" loading="lazy" />
            <div v-else class="lib-img skeleton" />
          </span>
          <span class="lib-name">{{ f.name }}</span>
        </div>
      </div>
    </section>

    <!-- ③ 牌背墙：连胜解锁进度 -->
    <section v-if="backs.length" class="block">
      <div class="block-head">
        <h2 class="block-title">牌背</h2>
        <span class="block-note">连胜最佳 {{ profile.maxStreak }} 天</span>
      </div>
      <div class="lib-row">
        <div v-for="b in backs" :key="b.id" class="lib-item" :class="{ locked: isBackLocked(b) }">
          <span class="lib-img-wrap">
            <img v-if="b.url" class="lib-img" :src="b.url" :alt="b.name" loading="lazy" />
            <div v-else class="lib-img skeleton" />
            <span v-if="isBackLocked(b)" class="lib-lock"><AppIcon name="lock" :size="14" /></span>
          </span>
          <span class="lib-name">{{ b.name }}</span>
          <span v-if="isBackLocked(b)" class="lib-lock-hint">{{ b.unlock }} 天解锁</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.collection {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 24px 20px calc(40px + env(safe-area-inset-bottom, 0px));
}

.head {
  margin-bottom: var(--sp-3);
  padding: 0 44px; /* 让出 FlowExit 图标位 */
}

.title {
  font-size: var(--fs-title);
}

.subtitle {
  margin-top: 6px;
  color: var(--dim);
  font-size: var(--fs-note);
}

.block {
  margin-bottom: var(--sp-4);
}

.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}

.block-title {
  font-size: var(--fs-note);
  color: var(--dim);
  font-weight: var(--w-strong);
  letter-spacing: 0.12em;
}

.block-note {
  font-size: var(--fs-note);
  color: var(--dim);
}

/* 收集进度：当前项用金 */
.progress-badge {
  font-size: 0.8rem;
  font-weight: var(--w-strong);
  color: var(--gold-text);
}

.card-wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px;
}

.wall-item {
  position: relative;
  aspect-ratio: 300 / 527;
  padding: 0;
  background: none;
  border: none;
  border-radius: var(--radius-img);
  overflow: hidden;
  cursor: default;
  -webkit-tap-highlight-color: transparent;
}

.wall-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: var(--radius-img);
  box-shadow: var(--shadow-card);
}

/* 未遇见的牌：暗色轮廓，只留锁形剪影 */
.silhouette {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dim);
  background: var(--sunk);
  border: 1px dashed var(--line);
  border-radius: var(--radius-img);
  opacity: 0.55;
}

.wall-item.lit {
  cursor: pointer;
}

.count-badge {
  position: absolute;
  right: 3px;
  bottom: 3px;
  min-width: 18px;
  padding: 1px 5px;
  font-size: 0.625rem;
  font-weight: var(--w-strong);
  text-align: center;
  color: var(--on-gold);
  background: var(--gold);
  border-radius: var(--radius-pill);
}

/* 皮肤/牌背墙：与牌库页同语言 */
.lib-row {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.lib-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  width: 76px;
}

.lib-img-wrap {
  position: relative;
}

.lib-img {
  width: 76px;
  aspect-ratio: 300 / 527;
  object-fit: cover;
  border-radius: var(--radius-img);
  box-shadow: var(--shadow-card);
}

.lib-item.on .lib-img {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}

.lib-item.locked .lib-img {
  filter: grayscale(1) brightness(0.6);
}

.lib-name {
  font-size: 0.6875rem;
  color: var(--dim);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.lib-lock {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--paper);
}

.lib-lock-hint {
  font-size: 0.625rem;
  color: var(--dim);
}
</style>
