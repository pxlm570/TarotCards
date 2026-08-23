<script setup>
// PWA 安装引导（M5 Task 3）：监听 beforeinstallprompt，未安装时显示安装卡（7 天不再提示）。
import { ref, onMounted, onUnmounted } from 'vue'
import { safeGetItem, safeSetItem } from '../lib/storage.js'
import AppIcon from './AppIcon.vue'

const INSTALL_DISMISS_KEY = 'tarot.install-dismiss.v1'
const visible = ref(false)
const deferred = ref(null)

function inStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}

function maybeShow() {
  if (inStandalone()) return
  const last = Number(safeGetItem(INSTALL_DISMISS_KEY) || 0)
  if (Date.now() - last < 7 * 24 * 3600 * 1000) return
  visible.value = true
}

function onPrompt(e) {
  e.preventDefault()
  deferred.value = e
  maybeShow()
}

// iOS Safari/Chrome 永不触发 beforeinstallprompt，deferred 恒 null（旧版在此平台显示死按钮）
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function install() {
  if (!deferred.value) return
  const prompt = deferred.value
  deferred.value = null
  prompt.prompt()
  prompt.userChoice
    .then(() => {
      visible.value = false
    })
    .catch(() => {})
}

function dismiss() {
  visible.value = false
  safeSetItem(INSTALL_DISMISS_KEY, String(Date.now()))
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', onPrompt)
  // iOS 走指引文案；其余平台只在收到 BIP 事件（onPrompt）后才显示安装按钮
  if (isIOS() && !inStandalone()) maybeShow()
})
onUnmounted(() => window.removeEventListener('beforeinstallprompt', onPrompt))
</script>

<template>
  <div v-if="visible" class="install card">
    <div class="install-main">
      <span class="install-icon"><AppIcon name="star" :size="18" /></span>
      <p class="install-text">
        {{ deferred ? '安装到主屏幕，像 App 一样使用' : '用 Safari「分享 → 添加到主屏幕」，像 App 一样使用' }}
      </p>
    </div>
    <div class="install-actions">
      <button class="btn-text" @click="dismiss">稍后</button>
      <button v-if="deferred" class="btn-solid" @click="install">安装</button>
    </div>
  </div>
</template>

<style scoped>
.install {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 12px);
  z-index: 15;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.install-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.install-icon {
  color: var(--gold-text);
}

.install-text {
  font-size: var(--fs-body);
  font-weight: var(--w-strong);
}

.install-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.install-actions .btn-solid {
  padding: 8px 14px;
  font-size: var(--fs-note);
}
</style>
