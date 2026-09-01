<script setup>
// 首页 Hero 样张舞台（/hero-samples，仅预览不影响正式首页）：
// 三方向切换 + 「模拟已抽」状态开关 + 主题快速预览，底部工具条为样张专用非正式 UI。
import { ref, computed } from 'vue'
import SampleFan from '../components/hero-samples/SampleFan.vue'
import SampleCard from '../components/hero-samples/SampleCard.vue'
import SampleSky from '../components/hero-samples/SampleSky.vue'
import { tap } from '../lib/feedback.js'
import { setTheme, resolveTheme } from '../lib/theme.js'
import { loadSettings } from '../lib/storage.js'

const TABS = [
  { id: 'fan', label: '一 星光牌阵' },
  { id: 'card', label: '二 今日之牌' },
  { id: 'sky', label: '三 星穹氛围' }
]

const current = ref('fan')
const drawn = ref(false)
const dark = ref(resolveTheme(loadSettings().theme) === 'dark')

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 5) return '夜深了，让牌陪你静一静'
  if (h < 11) return '早安，今天想问点什么？'
  if (h < 14) return '午后小憩，抽一张牌吧'
  if (h < 19) return '傍晚好，回顾一下今天'
  return '晚上好，此刻适合占卜'
})

const comp = computed(() => ({ fan: SampleFan, card: SampleCard, sky: SampleSky })[current.value])

function switchTab(id) {
  tap()
  current.value = id
}

function toggleDrawn() {
  tap()
  drawn.value = !drawn.value
}

function toggleTheme() {
  tap()
  dark.value = setTheme(dark.value ? 'light' : 'dark') === 'dark'
}
</script>

<template>
  <div class="stage">
    <component :is="comp" :drawn="drawn" :greeting="greeting" />

    <nav class="bar" aria-label="样张切换工具条">
      <button
        v-for="t in TABS"
        :key="t.id"
        type="button"
        class="chip"
        :class="{ on: current === t.id }"
        @click="switchTab(t.id)"
      >
        {{ t.label }}
      </button>
      <span class="sep" aria-hidden="true" />
      <button type="button" class="chip" :class="{ on: drawn }" @click="toggleDrawn">模拟已抽</button>
      <button type="button" class="chip" @click="toggleTheme">{{ dark ? '浅色预览' : '暗夜预览' }}</button>
      <router-link class="chip" to="/">原首页</router-link>
    </nav>
  </div>
</template>

<style scoped>
.stage {
  min-height: 100vh;
}

.bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
  background: var(--surface);
  border-top: 1px solid var(--line);
  overflow-x: auto;
  scrollbar-width: none;
}

.bar::-webkit-scrollbar {
  display: none;
}

.bar .chip {
  flex-shrink: 0;
  text-decoration: none;
}

.sep {
  flex-shrink: 0;
  width: 1px;
  height: 20px;
  background: var(--line);
}
</style>
