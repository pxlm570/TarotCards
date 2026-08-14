<script setup>
// 占卜动线统一退出入口（Task 18）：每页左上角「退出」。
// 中途阶段(question~reveal)点退出 → 二次确认后整局作废回首页；
// 解读页(已落库)confirm=false 直接回首页、不重复保存。
import { useRouter } from 'vue-router'
import { useReadingStore } from '../stores/reading.js'
import AppIcon from './AppIcon.vue'
import { tap } from '../lib/feedback.js'

const props = defineProps({
  confirm: { type: Boolean, default: true }
})

const router = useRouter()
const store = useReadingStore()

function exit() {
  if (props.confirm && !window.confirm('退出后本局作废，确定吗？')) return
  tap()
  store.reset()
  router.replace('/')
}
</script>

<template>
  <button class="flow-exit btn-ghost" @click="exit">
    <AppIcon name="arrow" :size="15" style="transform: rotate(180deg)" />
    退出
  </button>
</template>

<style scoped>
.flow-exit {
  padding: 8px 12px;
  font-size: var(--fs-note);
  flex-shrink: 0;
}
</style>
