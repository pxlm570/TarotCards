<script setup>
// 统一线性图标（M1.5 Task 4）：24×24 网格、stroke 2.4、圆头圆角、无填充。
// 全站不再用 emoji 当功能图标——emoji 各平台造型不一，破坏风格一致性。
// 颜色走 currentColor，随主题与父元素文字色自动变。
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 22 }
})

// 只放 SFC 内静态字符串，无外部输入（v-html 安全）
const ICONS = {
  // ---- TabBar 五项 ----
  // 水晶球：球体 + 星芒 + 底座（纯圆形会读成放大镜）
  reading:
    '<circle cx="12" cy="9.8" r="6.2"/><path fill="currentColor" stroke="none" d="M12 6.9l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/><path d="M7.8 18.9h8.4M9.9 16.2l-1.3 2.7M14.1 16.2l1.3 2.7"/>',
  // 摊开的书 + 书脊
  learn:
    '<path d="M12 7.6C10.5 5.9 8.5 5.1 5.6 5.1H4v12.6h1.6c2.9 0 4.9.8 6.4 2.4 1.5-1.6 3.5-2.4 6.4-2.4H20V5.1h-1.6c-2.9 0-4.9.8-6.4 2.5z"/><path d="M12 7.6v12.5"/>',
  // 一张牌 + 身后斜插的另一张
  deck: '<rect x="3.5" y="7" width="10.5" height="13.5" rx="2"/><path d="M8.3 4.7l6.8-1.5a2 2 0 0 1 2.4 1.5l2.4 11.4a2 2 0 0 1-1.5 2.4l-1.6.3"/>',
  journal: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8.5 8.5h7M8.5 12.5h7M8.5 16.5h4"/>',
  profile: '<circle cx="12" cy="8.5" r="3.7"/><path d="M4.8 20a7.6 7.6 0 0 1 14.4 0"/>',
  // ---- 功能 ----
  help: '<path d="M9 9a3 3 0 1 1 4.6 2.5c-.9.6-1.6 1.2-1.6 2.3"/><path d="M12 17.5h.01"/>',
  // 认识牌面入口：睁眼观牌（学习页「去牌库认牌」）
  eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  pen: '<path d="M5 19h3.5L19 8.5a2.47 2.47 0 0 0-3.5-3.5L5 15.5V19z"/><path d="M14.5 6l3.5 3.5"/>',
  note: '<path d="M4.5 5.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9l-5 5h-8a2 2 0 0 1-2-2z"/><path d="M19.5 14.5h-5v5"/><path d="M8.5 9h7M8.5 12.5h4"/>',
  drag: '<path d="M12 4v16M4 12h16"/><path d="M9.5 6.5L12 4l2.5 2.5M9.5 17.5L12 20l2.5-2.5M6.5 9.5L4 12l2.5 2.5M17.5 9.5L20 12l-2.5 2.5"/>',
  moon: '<path d="M20 14.6A8.5 8.5 0 0 1 9.4 4 8.5 8.5 0 1 0 20 14.6z"/>',
  // 日照：四季仪式（春分/夏至/秋分/冬至）提示行用，与月相/生日星芒区分
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/>',
  star: '<path d="M12 3.2c.7 4.6 3.5 7.4 8.1 8.1-4.6.7-7.4 3.5-8.1 8.1-.7-4.6-3.5-7.4-8.1-8.1 4.6-.7 7.4-3.5 8.1-8.1z"/>',
  sparkle:
    '<path d="M10 3.5c.5 3.4 2.6 5.5 6 6-3.4.5-5.5 2.6-6 6-.5-3.4-2.6-5.5-6-6 3.4-.5 5.5-2.6 6-6z"/><path d="M18 14.5c.25 1.7 1.3 2.75 3 3-1.7.25-2.75 1.3-3 3-.25-1.7-1.3-2.75-3-3 1.7-.25 2.75-1.3 3-3z"/>',
  // 放大镜（牌详情页「点按查看大图」）
  zoom: '<circle cx="11" cy="11" r="6.5"/><path d="M15.7 15.7L20.5 20.5"/><path d="M8.5 11h5M11 8.5v5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M6 9.5l6 6 6-6"/>',
  arrow: '<path d="M4.5 12h14.5M13 5.5l6.5 6.5-6.5 6.5"/>'
}

const markup = computed(() => ICONS[props.name] ?? '')
</script>

<template>
  <svg
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    v-html="markup"
  />
</template>

<style scoped>
.app-icon {
  display: block;
  flex-shrink: 0;
}
</style>
