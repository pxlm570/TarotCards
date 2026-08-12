<script setup>
// 记录 Tab（M3 Task 2）：时间线（今天/昨天/更早）+ 领域筛选 + 关键词搜索。
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useJournalStore } from '../stores/journal.js'
import { currentDayKey } from '../lib/day-key.js'
import TimelineItem from '../components/TimelineItem.vue'
import AppIcon from '../components/AppIcon.vue'

const router = useRouter()
const journal = useJournalStore()

const DOMAINS = [
  { key: 'all', label: '全部' },
  { key: 'love', label: '感情' },
  { key: 'career', label: '事业' },
  { key: 'wealth', label: '财运' },
  { key: 'study', label: '学业' },
  { key: 'general', label: '综合' },
  { key: null, label: '随心' }
]

const domainFilter = ref('all')
const keyword = ref('')

const filtered = computed(() => {
  const kw = keyword.value.trim()
  return journal.readings.filter((r) => {
    if (domainFilter.value !== 'all' && (r.domain ?? null) !== domainFilter.value) return false
    if (kw && !(r.question ?? '').includes(kw)) return false
    return true
  })
})

// 按日分组（凌晨 4 点分界，与连胜一致）
const groups = computed(() => {
  const today = currentDayKey()
  const yest = currentDayKey(new Date(Date.now() - 24 * 3600 * 1000))
  const buckets = new Map()
  for (const r of filtered.value) {
    const day = currentDayKey(new Date(r.ts))
    const label = day === today ? '今天' : day === yest ? '昨天' : day
    if (!buckets.has(label)) buckets.set(label, [])
    buckets.get(label).push(r)
  }
  return [...buckets.entries()]
})
</script>

<template>
  <div class="journal">
    <header class="head">
      <h1 class="title">记录</h1>
    </header>

    <div class="search">
      <input v-model="keyword" class="search-input" type="search" placeholder="搜索问题关键词" />
    </div>

    <div class="chips">
      <button
        v-for="d in DOMAINS"
        :key="d.label"
        class="chip"
        :class="{ on: domainFilter === d.key }"
        @click="domainFilter = d.key"
      >
        {{ d.label }}
      </button>
    </div>

    <div v-if="filtered.length" class="timeline">
      <section v-for="[label, list] in groups" :key="label" class="group">
        <h2 class="group-label">{{ label }}</h2>
        <TimelineItem v-for="r in list" :key="r.id" :reading="r" @open="(id) => router.push(`/journal/${id}`)" />
      </section>
    </div>

    <div v-else class="empty">
      <span class="icon"><AppIcon name="journal" :size="34" /></span>
      <p class="empty-title">{{ keyword ? '没有匹配的记录' : '占卜历史将在这里沉淀' }}</p>
      <p class="hint">{{ keyword ? '换个关键词试试' : '完成一次占卜后会自动记录' }}</p>
      <router-link to="/" class="action btn-solid">去抽一张牌</router-link>
    </div>
  </div>
</template>

<style scoped>
.journal {
  padding: var(--sp-3) 20px var(--sp-4);
}

.title {
  font-size: var(--fs-title);
  margin-bottom: 14px;
}

.search {
  margin-bottom: 12px;
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

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: var(--sp-3);
}

.chip {
  padding: 8px 14px;
  font-size: 0.8125rem;
}

.group {
  margin-bottom: var(--sp-2);
}

.group-label {
  font-size: var(--fs-note);
  color: var(--dim);
  font-weight: var(--w-strong);
  margin-bottom: 8px;
  padding-left: 2px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding-top: 12vh;
  color: var(--dim);
}

.icon {
  width: 84px;
  height: 84px;
  margin-bottom: 6px;
  border-radius: 50%;
  background: var(--sunk);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dim);
}

.empty-title {
  font-size: var(--fs-head);
  font-weight: var(--w-strong);
  color: var(--ink);
}

.hint {
  font-size: var(--fs-note);
}

.action {
  margin-top: var(--sp-2);
  text-decoration: none;
}
</style>
