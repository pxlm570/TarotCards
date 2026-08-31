<script setup>
// 本命牌详情页：输入生日 -> 人格/灵魂牌（v1.5「我的」页收缩重构，从主页面迁入）。
import { ref, computed } from 'vue'
import { useProfileStore } from '../../stores/profile.js'
import { birthCards } from '../../lib/birth-cards.js'
import { useDeck } from '../../lib/use-deck.js'
import cardsData from '../../data/cards.json'
import PageHead from '../../components/PageHead.vue'
import { toast, success } from '../../lib/feedback.js'

const profile = useProfileStore()
const { cardUrl } = useDeck()
const cardById = new Map(cardsData.map((c) => [c.id, c]))

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
  <div class="page birth">
    <PageHead title="本命牌" back-to="/profile" back-label="我的" sub="输入生日，找到属于你的两张大阿尔卡纳牌——它们代表你的人格面具与灵魂课题。" />

    <section class="card block">
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
        <input v-model="birthdayInput" class="birth-input" type="date" max="2026-12-31" />
        <button class="birth-save btn-solid btn-block" :disabled="!/^\d{4}-\d{2}-\d{2}$/.test(birthdayInput)" @click="saveBirthday">算出我的本命牌</button>
      </template>
    </section>
  </div>
</template>

<style scoped>
.birth {
  padding: var(--sp-3) 20px var(--sp-4);
}

.block {
  padding: var(--sp-2);
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
