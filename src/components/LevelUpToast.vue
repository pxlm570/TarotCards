<script setup>
// 升级庆祝（#9 UX）：监听 profile XP，等级提升时弹出短暂庆祝横幅。
import { ref, watch, onBeforeUnmount } from 'vue'
import { useProfileStore } from '../stores/profile.js'
import { levelProgress, levelCardId } from '../lib/xp.js'
import cardsData from '../data/cards.json'
import AppIcon from './AppIcon.vue'

const cardById = new Map(cardsData.map((c) => [c.id, c]))
const profile = useProfileStore()

const show = ref(false)
const msg = ref('')
let lastLevel = levelProgress(profile.xp).level
let timer = null

watch(
  () => profile.xp,
  (xp) => {
    const level = levelProgress(xp).level
    if (level > lastLevel) {
      const name = cardById.get(levelCardId(level))?.name ?? ''
      msg.value = `升级到 Lv.${level} · ${name}`
      show.value = true
      clearTimeout(timer)
      timer = setTimeout(() => (show.value = false), 2600)
    }
    lastLevel = level
  }
)

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <Transition name="pop">
    <div v-if="show" class="levelup">
      <span class="icon"><AppIcon name="star" :size="26" /></span>
      <div>
        <p class="t1">恭喜升级</p>
        <p class="t2">{{ msg }}</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.levelup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 80;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 26px;
  border-radius: var(--radius-card);
  background: var(--surface);
  border: 2px solid var(--gold-deep);
  box-shadow: var(--shadow-pop);
}

.icon {
  color: var(--gold-text);
}

.t1 {
  font-size: var(--fs-note);
  color: var(--dim);
}

.t2 {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  color: var(--gold-text);
}
</style>
