<script setup>
// 闪卡（M2 Task 4）：正面牌面图，点击 3D 翻面显示名称与关键词。
import { ref, watch } from 'vue'

const props = defineProps({
  card: { type: Object, required: true }, // { name, nameEn, keywords: { upright } }
  img: { type: String, default: '' } // 牌面图 URL（皮肤未就位时为空 → 骨架占位）
})

const flipped = ref(false)

// 换一张卡时重置为正面
watch(
  () => props.card,
  () => {
    flipped.value = false
  }
)
</script>

<template>
  <button class="flash" :class="{ flipped }" @click="flipped = !flipped">
    <div class="inner">
      <div class="face front">
        <img v-if="img" :src="img" alt="" draggable="false" />
        <div v-else class="skeleton" />
      </div>
      <div class="face back card">
        <p class="name">{{ card.name }}</p>
        <p class="name-en">{{ card.nameEn }}</p>
        <div class="kw">
          <span v-for="k in card.keywords?.upright ?? []" :key="k" class="tag-kw">{{ k }}</span>
        </div>
        <p class="hint">点击翻面</p>
      </div>
    </div>
  </button>
</template>

<style scoped>
.flash {
  width: 100%;
  aspect-ratio: 300 / 527;
  max-width: 220px;
  margin: 0 auto;
  perspective: 900px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.2, 0.7, 0.3, 1);
}

.flash.flipped .inner {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: var(--radius-img);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-card);
}

.face.front img,
.face.front .skeleton {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.face.back {
  transform: rotateY(180deg);
  border: 2px solid var(--line);
  background: var(--surface);
  border-radius: var(--radius-card);
  gap: 8px;
  padding: 16px;
  text-align: center;
}

.name {
  font-size: var(--fs-title);
  font-weight: var(--w-title);
}

.name-en {
  font-size: var(--fs-note);
  color: var(--dim);
}

.kw {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.hint {
  position: absolute;
  bottom: 14px;
  font-size: 0.6875rem;
  color: var(--dim);
  opacity: 0.7;
}

@media (prefers-reduced-motion: reduce) {
  .inner {
    transition: none;
  }
}
</style>
