<script setup>
// M4 交付完整设置页（AI 配置/主题/导出导入）。M1 验收需要：逆位与代抽的临时开关。
// M1.5 起提供主题三态（跟随系统 / 浅色 / 暗夜）。
// M3：XP 等级条、本命牌（生日 → 人格/灵魂牌）。
import { ref, computed } from 'vue'
import { loadSettings, saveSettings } from '../lib/storage.js'
import { setTheme, THEME_VALUES } from '../lib/theme.js'
import { useProfileStore } from '../stores/profile.js'
import { birthCards } from '../lib/birth-cards.js'
import { useDeck } from '../lib/use-deck.js'
import cardsData from '../data/cards.json'
import XpBar from '../components/XpBar.vue'
import AppIcon from '../components/AppIcon.vue'
import { toast, success } from '../lib/feedback.js'

const settings = ref(loadSettings())
const profile = useProfileStore()
const { cardUrl } = useDeck()
const cardById = new Map(cardsData.map((c) => [c.id, c]))

const THEME_LABEL = { auto: '跟随系统', light: '浅色', dark: '暗夜' }

function toggle(key) {
  settings.value = saveSettings({ [key]: !settings.value[key] })
}

function pickTheme(value) {
  setTheme(value)
  settings.value = loadSettings()
}

// ---- 本命牌 ----
const birthdayInput = ref('')
const birth = computed(() => {
  if (!profile.birthday) return null
  const [y, m, d] = profile.birthday.split('-').map(Number)
  return birthCards(y, m, d)
})

function saveBirthday() {
  const v = birthdayInput.value
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return
  profile.setBirthday(v)
  success()
  toast('已生成你的本命牌', 'success')
}
</script>

<template>
  <div class="profile">
    <h1 class="title">我的</h1>

    <section class="card block">
      <XpBar show-next />
    </section>

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
      <template v-if="birth">
        <div class="birth-cards">
          <div v-for="id in birth.majors" :key="id" class="birth-card">
            <img v-if="cardUrl(id)" class="birth-img" :src="cardUrl(id)" :alt="id" />
            <span class="birth-name">{{ cardById.get(id)?.name }}</span>
          </div>
        </div>
        <p class="birth-display">人格 / 灵魂 · {{ birth.display }}</p>
        <p class="birth-hint">「{{ birth.majors.map((id) => cardById.get(id)?.name).join('」与「') }}」是你的本命牌，代表着你的内在与灵魂课题。</p>
        <button class="change btn-text" @click="profile.setBirthday(''); birthdayInput = ''">重新输入生日</button>
      </template>
      <template v-else>
        <p class="row-hint">输入生日，找到属于你的牌。</p>
        <input v-model="birthdayInput" class="birth-input" type="date" max="2026-12-31" />
        <button class="birth-save btn-ghost btn-block" :disabled="!/^\d{4}-\d{2}-\d{2}$/.test(birthdayInput)" @click="saveBirthday">算出我的本命牌</button>
      </template>
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

.temp-note {
  margin-top: var(--sp-1);
  font-size: 0.75rem;
  color: var(--dim);
  text-align: center;
}

.birth-cards {
  display: flex;
  justify-content: center;
  gap: 18px;
  margin-bottom: 10px;
}

.birth-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.birth-img {
  width: 92px;
  aspect-ratio: 300 / 527;
  border-radius: var(--radius-img);
  object-fit: cover;
  box-shadow: var(--shadow-card);
}

.birth-name {
  font-size: var(--fs-note);
  font-weight: var(--w-strong);
  color: var(--gold-text);
}

.birth-display {
  text-align: center;
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  color: var(--gold-text);
  margin-bottom: 6px;
}

.birth-hint {
  text-align: center;
  font-size: var(--fs-note);
  color: var(--dim);
  line-height: 1.7;
}

.change {
  display: block;
  margin: 10px auto 0;
  color: var(--dim);
}

.birth-input {
  width: 100%;
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 12px;
  color: var(--ink);
  font-size: 1rem;
  margin-bottom: 10px;
}

.birth-input:focus {
  outline: none;
  border-color: var(--gold-deep);
}
</style>
