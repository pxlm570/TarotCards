<script setup>
// 占卜偏好详情页：逆位/代抽开关（v1.5「我的」页收缩重构，从主页面迁入）。
import { ref } from 'vue'
import { loadSettings, saveSettings } from '../../lib/storage.js'
import PageHead from '../../components/PageHead.vue'

const settings = ref(loadSettings())

function toggle(key) {
  settings.value = saveSettings({ [key]: !settings.value[key] })
}
</script>

<template>
  <div class="page preference">
    <PageHead title="占卜偏好" back-to="/profile" back-label="我的" sub="影响抽牌与解读方式，随时可改。" />

    <section class="card block">
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
    </section>
  </div>
</template>

<style scoped>
.preference {
  padding: var(--sp-3) 20px var(--sp-4);
}

.block {
  padding: var(--sp-2);
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
