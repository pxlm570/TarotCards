<script setup>
// 二级页统一页头：返回键 + 标题 + 可选副文案。「我的」详情页与动线外二级页共用。
// 返回语义统一走 use-back：有来源页 back()（保住浏览器的自然回退链），
// 直链/刷新进入（history.state 无 back）时 replace 回上级，不产生死胡同。
import AppIcon from './AppIcon.vue'
import { useBack } from '../composables/use-back.js'

defineProps({
  title: { type: String, required: true },
  sub: { type: String, default: '' },
  backTo: { type: String, required: true },
  backLabel: { type: String, default: '返回' }
})

const goBack = useBack()
</script>

<template>
  <header class="page-head">
    <button class="back btn-text" @click="goBack(backTo)">
      <AppIcon name="arrow" :size="16" style="transform: rotate(180deg)" />
      {{ backLabel }}
    </button>
    <h1 class="title">{{ title }}</h1>
    <p v-if="sub" class="sub">{{ sub }}</p>
  </header>
</template>

<style scoped>
.page-head {
  margin-bottom: var(--sp-3);
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-left: 0;
  margin-bottom: 8px;
}

.title {
  font-size: var(--fs-title);
}

.sub {
  font-size: var(--fs-note);
  color: var(--dim);
  margin: 6px 0 0;
  line-height: 1.7;
}
</style>
