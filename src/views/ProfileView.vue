<script setup>
// M4 交付完整设置页（AI 配置/主题/导出导入）。M1 验收需要：逆位与代抽的临时开关。
import { ref } from 'vue'
import { loadSettings, saveSettings } from '../lib/storage.js'

const settings = ref(loadSettings())

function toggle(key) {
  settings.value = saveSettings({ [key]: !settings.value[key] })
}
</script>

<template>
  <div class="profile">
    <h1 class="title">我的</h1>

    <section class="card">
      <h2 class="card-title">占卜偏好</h2>
      <label class="row">
        <div>
          <span>启用逆位</span>
          <p class="row-hint">逆位解读更完整，也更考验功底（建议学完第 5 章再开）</p>
        </div>
        <input type="checkbox" :checked="settings.reversalsEnabled" @change="toggle('reversalsEnabled')" />
      </label>
      <label class="row">
        <div>
          <span>为我代抽</span>
          <p class="row-hint">抽牌环节自动完成，适合快速占卜</p>
        </div>
        <input type="checkbox" :checked="settings.autoDraw" @change="toggle('autoDraw')" />
      </label>
      <p class="temp-note">临时开关 · 完整设置页在里程碑 M4</p>
    </section>

    <section class="card">
      <h2 class="card-title">本命牌</h2>
      <p class="row-hint">输入生日，找到属于你的牌 · 敬请期待（M3）</p>
    </section>
  </div>
</template>

<style scoped>
.profile {
  padding: 24px 20px;
}

.title {
  font-size: 1.375rem;
  margin-bottom: 24px;
}

.card {
  background: var(--bg-card);
  border-radius: var(--radius-card);
  padding: 16px;
  margin-bottom: 16px;
}

.card-title {
  font-size: 1rem;
  margin-bottom: 12px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
  cursor: pointer;
}

.row-hint {
  font-size: 0.8125rem;
  color: var(--moon-dim);
  margin-top: 2px;
}

.row input {
  width: 20px;
  height: 20px;
  accent-color: var(--gold);
  flex-shrink: 0;
}

.temp-note {
  margin-top: 8px;
  font-size: 0.75rem;
  color: var(--moon-dim);
  text-align: center;
}
</style>
