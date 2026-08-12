<script setup>
// XP 进度条（M3 Task 4）：显示当前等级（大阿尔克那名）+ 本级进度。
import { computed } from 'vue'
import { useProfileStore } from '../stores/profile.js'
import { levelProgress, levelCardId } from '../lib/xp.js'
import cardsData from '../data/cards.json'

const cardById = new Map(cardsData.map((c) => [c.id, c]))

const props = defineProps({
  showNext: { type: Boolean, default: false }
})

const profile = useProfileStore()
const prog = computed(() => levelProgress(profile.xp))
const levelName = computed(() => cardById.get(levelCardId(prog.value.level))?.name ?? '')
const nextName = computed(() => cardById.get(levelCardId(Math.min(22, prog.value.level + 1)))?.name ?? '')
</script>

<template>
  <div class="xp">
    <div class="xp-head">
      <span class="xp-level">Lv.{{ prog.level }} · {{ levelName }}</span>
      <span v-if="showNext && prog.level < 22" class="xp-next">再 {{ prog.span - prog.into }} XP 晋升 {{ nextName }}</span>
      <span v-else-if="prog.level >= 22" class="xp-next">已达最高等级</span>
    </div>
    <div class="xp-track"><div class="xp-fill" :style="{ width: Math.round(prog.pct * 100) + '%' }" /></div>
  </div>
</template>

<style scoped>
.xp-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}

.xp-level {
  font-size: var(--fs-body);
  font-weight: var(--w-title);
  color: var(--gold-text);
}

.xp-next {
  font-size: 0.6875rem;
  color: var(--dim);
}

.xp-track {
  height: 10px;
  border-radius: var(--radius-pill);
  background: var(--sunk);
  overflow: hidden;
}

.xp-fill {
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--gold);
  transition: width var(--t-mid) var(--ease-out);
}
</style>
