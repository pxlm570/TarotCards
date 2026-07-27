<script setup>
// M4 交付完整设置页（AI 配置/主题/导出导入）。M1 验收需要：逆位与代抽的临时开关。
// M1.5 起提供主题三态（跟随系统 / 浅色 / 暗夜）——双主题必须有地方能锁定。
import { ref } from 'vue'
import { loadSettings, saveSettings } from '../lib/storage.js'
import { setTheme, THEME_VALUES } from '../lib/theme.js'

const settings = ref(loadSettings())

const THEME_LABEL = { auto: '跟随系统', light: '浅色', dark: '暗夜' }

function toggle(key) {
  settings.value = saveSettings({ [key]: !settings.value[key] })
}

function pickTheme(value) {
  setTheme(value)
  settings.value = loadSettings()
}
</script>

<template>
  <div class="profile">
    <h1 class="title">我的</h1>

    <section class="card block">
      <h2 class="card-title">外观</h2>
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
      <h2 class="card-title">占卜偏好</h2>
      <label class="row">
        <div>
          <span class="row-name">启用逆位</span>
          <p class="row-hint">逆位解读更完整，也更考验功底（建议学完第 5 章再开）</p>
        </div>
        <input type="checkbox" :checked="settings.reversalsEnabled" @change="toggle('reversalsEnabled')" />
      </label>
      <label class="row">
        <div>
          <span class="row-name">为我代抽</span>
          <p class="row-hint">抽牌环节自动完成，适合快速占卜</p>
        </div>
        <input type="checkbox" :checked="settings.autoDraw" @change="toggle('autoDraw')" />
      </label>
      <p class="temp-note">临时开关 · 完整设置页在里程碑 M4</p>
    </section>

    <section class="card block">
      <h2 class="card-title">本命牌</h2>
      <p class="row-hint">输入生日，找到属于你的牌 · 敬请期待（M3）</p>
    </section>
  </div>
</template>

<style scoped>
.profile {
  padding: var(--sp-3) 20px var(--sp-4);
}

.title {
  font-size: var(--fs-title);
  margin-bottom: var(--sp-3);
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
  padding: 10px 0;
  cursor: pointer;
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

.temp-note {
  margin-top: var(--sp-1);
  font-size: 0.75rem;
  color: var(--dim);
  text-align: center;
}
</style>
