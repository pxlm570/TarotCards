<script setup>
// 进度环（M2 Task 4）：SVG 圆环，value ∈ [0,1]。完成时金色。
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  size: { type: Number, default: 56 },
  stroke: { type: Number, default: 6 }
})

const radius = computed(() => (props.size - props.stroke) / 2)
const circ = computed(() => 2 * Math.PI * radius.value)
const offset = computed(() => circ.value * (1 - Math.min(1, Math.max(0, props.value))))
</script>

<template>
  <svg class="progress-ring" :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
    <circle
      class="track"
      :cx="size / 2"
      :cy="size / 2"
      :r="radius"
      fill="none"
      :stroke-width="stroke"
    />
    <circle
      class="bar"
      :cx="size / 2"
      :cy="size / 2"
      :r="radius"
      fill="none"
      :stroke-width="stroke"
      :stroke-dasharray="circ"
      :stroke-dashoffset="offset"
      stroke-linecap="round"
      :transform="`rotate(-90 ${size / 2} ${size / 2})`"
    />
  </svg>
</template>

<style scoped>
.progress-ring {
  display: block;
}

.track {
  stroke: var(--line);
}

.bar {
  stroke: var(--gold);
  transition: stroke-dashoffset var(--t-mid) var(--ease-out);
}
</style>
