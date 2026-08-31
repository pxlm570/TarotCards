<script setup>
// 外观详情页：主题三态 / 减弱动效 / 字号（v1.5「我的」页收缩重构，从主页面迁入）。
import { ref } from 'vue'
import { loadSettings, saveSettings } from '../../lib/storage.js'
import { setTheme, THEME_VALUES } from '../../lib/theme.js'
import { applyMotionPreference } from '../../lib/feedback.js'
import PageHead from '../../components/PageHead.vue'

const settings = ref(loadSettings())
const THEME_LABEL = { auto: '跟随系统', light: '浅色', dark: '暗夜' }

function pickTheme(value) {
  setTheme(value)
  settings.value = loadSettings()
}

function toggleMotion() {
  const next = !settings.value.reducedMotion
  settings.value = saveSettings({ reducedMotion: next })
  applyMotionPreference() // 立即生效
}

function pickFontSize(size) {
  settings.value = saveSettings({ fontSize: size })
  const el = document.documentElement
  if (size === 'large') el.setAttribute('data-fontsize', 'large')
  else el.removeAttribute('data-fontsize')
}
</script>

<template>
  <div class="page appearance">
    <PageHead title="外观" back-to="/profile" back-label="我的" sub="主题、动效与字号。切换立即生效，牌面与牌背的组合在牌库页选择。" />

    <section class="card block">
      <h2 class="card-title">主题</h2>
      <div class="chips">
        <button
          v-for="value in THEME_VALUES"
          :key="value"
          class="chip"
          :class="{ on: settings.theme === value }"
          @click="pickTheme(value)"
        >
          {{ THEME_LABEL[value] }}
        </button>
      </div>
    </section>

    <section class="card block">
      <h2 class="card-title">动效与字号</h2>
      <label class="row">
        <div>
          <span class="row-name">减弱动效</span>
          <p class="row-hint">减少缩放与闪烁，更适合夜间或敏感用户</p>
        </div>
        <input type="checkbox" :checked="settings.reducedMotion" @change="toggleMotion" />
      </label>
      <div class="chips" style="margin-top: 10px">
        <button
          v-for="s in [['standard', '标准'], ['large', '睡前大字']]"
          :key="s[0]"
          class="chip"
          :class="{ on: settings.fontSize === s[0] }"
          @click="pickFontSize(s[0])"
        >{{ s[1] }}</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.appearance {
  padding: var(--sp-3) 20px var(--sp-4);
}

.block {
  padding: var(--sp-2);
  margin-bottom: var(--sp-2);
}

.card-title {
  font-size: var(--fs-head);
  margin-bottom: 12px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-2);
  padding: 10px;
  margin: 0 -10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background var(--t-press);
}

.row:active {
  background: var(--sunk);
}

.row-name {
  font-size: var(--fs-body);
  font-weight: var(--w-strong);
}

.row-hint {
  font-size: var(--fs-note);
  color: var(--dim);
  margin-top: 2px;
  line-height: 1.7;
}

.row input {
  width: 22px;
  height: 22px;
  accent-color: var(--gold-deep);
  flex-shrink: 0;
}
</style>
