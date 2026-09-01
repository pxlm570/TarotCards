<script setup>
// 占卜动线统一退出入口（Task 18 + Task 20-A 轻量化）：
// 左上角纯图标（无文字、无按钮条），触摸目标 ≥44×44。五页形态一致。
// confirm=true（中途）退出前确认整局作废；beforeExit 回调返回真（有未保存草稿）时先确认再退。
// reset=false 只返回不动 store——给动线外的页面（如 /spreads）复用同款返回，
// 免得从首页带着进行中的一局逛过来再返回时把它静默作废。
// 退出落点（2026-08-31「从哪进、退回哪」）：
//  - to：显式目标（占卜动线专用——动线前进是 replace、返回手势会消费入口条目，
//    history.back() 回不到入口，须传 reading store 持久化的 entryPath）；
//  - 其余页面走智能返回：有来源页 back()，直链进入 replace(fallback)。
import { useRouter } from 'vue-router'
import { useReadingStore } from '../stores/reading.js'
import AppIcon from './AppIcon.vue'
import { tap } from '../lib/feedback.js'

const props = defineProps({
  confirm: { type: Boolean, default: true },
  beforeExit: { type: Function, default: null },
  reset: { type: Boolean, default: true },
  label: { type: String, default: '退出占卜' },
  to: { type: String, default: null },
  fallback: { type: String, default: '/' }
})

const router = useRouter()
const store = useReadingStore()

function exit() {
  if (typeof props.beforeExit === 'function' && props.beforeExit()) {
    if (!window.confirm('你写下的感想/练习理解还没有保存，退出将丢失它们。确定吗？')) return
  }
  if (props.confirm && !window.confirm('退出后本局作废，确定吗？')) return
  tap()
  if (props.reset) store.reset()
  if (props.to != null) {
    router.replace(props.to)
  } else if (window.history.state?.back) {
    router.back()
  } else {
    router.replace(props.fallback)
  }
}
</script>

<template>
  <button class="flow-exit" :aria-label="label" @click="exit">
    <AppIcon name="arrow" :size="24" style="transform: rotate(180deg)" />
  </button>
</template>

<style scoped>
.flow-exit {
  /* 纯图标 ghost：无文字无描边，内边距撑出 ≥44×44 触摸目标 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 10px;
  background: none;
  border: none;
  color: var(--dim);
  cursor: pointer;
  align-self: flex-start;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  transition: color var(--t-fast);
}

.flow-exit:active {
  color: var(--ink);
}

.flow-exit:focus-visible {
  outline: 2px solid var(--gold-text);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
</style>
