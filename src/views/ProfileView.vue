<script setup>
// 「我的」主页（v1.5 收缩重构，2026-08-31 用户反馈：功能栏太多）：
// XP 条 + 内联本命牌 + 分组条目列表，每项点击进独立详情页详细选择（/profile/*）。
// 本命牌 2026-09-02 用户反馈：不单独开页，直接在主页展示（输入与结果都内联）。
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import cardsData from '../data/cards.json'
import { loadSettings } from '../lib/storage.js'
import { useProfileStore } from '../stores/profile.js'
import { birthCards } from '../lib/birth-cards.js'
import { useDeck } from '../lib/use-deck.js'
import { version } from '../../package.json'
import XpBar from '../components/XpBar.vue'
import AppIcon from '../components/AppIcon.vue'
import { tap, toast, success } from '../lib/feedback.js'

const router = useRouter()
const profile = useProfileStore()
const settings = loadSettings()
const { cardUrl } = useDeck()

const cardById = new Map(cardsData.map((c) => [c.id, c]))

const THEME_LABEL = { auto: '跟随系统', light: '浅色', dark: '暗夜' }

const birth = computed(() => {
  if (!profile.birthday) return null
  const [y, m, d] = profile.birthday.split('-').map(Number)
  return birthCards(y, m, d)
})
const birthNames = computed(() =>
  birth.value ? birth.value.majors.map((id) => cardById.get(id)?.name ?? '').join('」与「') : ''
)

// ---- 内联本命牌：输入 / 重设 ----
const BIRTH_RE = /^\d{4}-\d{2}-\d{2}$/
const birthdayInput = ref('')

function saveBirthday() {
  if (!BIRTH_RE.test(birthdayInput.value)) return
  profile.setBirthday(birthdayInput.value)
  success()
  toast('已生成你的本命牌', 'success')
}

function resetBirthday() {
  tap()
  profile.setBirthday('')
  birthdayInput.value = ''
}

function goCard(id) {
  tap()
  router.push(`/deck/${id}`)
}

// 条目摘要即时反映当前设置（详情页改完返回，主页重挂载即读到新值）
const groups = computed(() => [
  {
    title: '个人',
    items: [{ to: '/collection', icon: 'star', name: '收藏馆', sub: '牌面收集与鉴赏' }]
  },
  {
    title: '偏好',
    items: [
      {
        to: '/profile/appearance',
        icon: 'sun',
        name: '外观',
        sub: `主题${settings.fontSize === 'large' ? ' · 睡前大字' : ''} · ${THEME_LABEL[settings.theme] ?? '跟随系统'}`
      },
      {
        to: '/profile/preference',
        icon: 'reading',
        name: '占卜偏好',
        sub: settings.reversalsEnabled ? '逆位已启用' : '标准解读 · 可开逆位'
      },
      {
        to: '/profile/ai',
        icon: 'sparkle',
        name: 'AI 解读',
        sub: settings.baseUrl ? settings.model || '已配置端点' : '未配置（可选功能）'
      }
    ]
  },
  {
    title: '数据与关于',
    items: [
      { to: '/profile/data', icon: 'note', name: '数据', sub: '本机存储 · 可导出备份' },
      { to: '/profile/about', icon: 'help', name: '关于', sub: `星语塔罗 v${version}` }
    ]
  }
])

function goEntry(to) {
  tap()
  router.push(to)
}
</script>

<template>
  <div class="profile">
    <h1 class="title">我的</h1>

    <section class="card block">
      <XpBar show-next />
    </section>

    <!-- 本命牌：内联展示（2026-09-02 定稿，不再单独开页） -->
    <section class="card block birth-block">
      <div class="birth-head">
        <h2 class="group-title">本命牌</h2>
        <button v-if="birth" class="reset btn-text" @click="resetBirthday">重设</button>
      </div>

      <template v-if="birth">
        <div class="birth-row">
          <div class="birth-imgs">
            <button
              v-for="id in birth.majors"
              :key="id"
              type="button"
              class="birth-img-btn"
              :aria-label="cardById.get(id)?.name"
              @click="goCard(id)"
            >
              <img v-if="cardUrl(id)" class="birth-img" :src="cardUrl(id)" :alt="cardById.get(id)?.name" />
              <span v-else class="birth-img ph" />
            </button>
          </div>
          <div class="birth-info">
            <p class="birth-names">「{{ birthNames }}」</p>
            <p class="birth-sub">人格 / 灵魂 · {{ birth.display }}</p>
          </div>
        </div>
      </template>

      <template v-else>
        <p class="birth-lead">输入生日，找到属于你的大阿尔卡纳本命牌——代表你的人格面具与灵魂课题。</p>
        <input v-model="birthdayInput" class="birth-input" type="date" max="2026-12-31" />
        <button class="birth-save btn-solid btn-block" :disabled="!BIRTH_RE.test(birthdayInput)" @click="saveBirthday">
          算出我的本命牌
        </button>
      </template>
    </section>

    <section v-for="g in groups" :key="g.title" class="card block group">
      <h2 class="group-title">{{ g.title }}</h2>
      <button
        v-for="(item, i) in g.items"
        :key="item.to"
        class="entry"
        :class="{ 'entry-divide': i > 0 }"
        @click="goEntry(item.to)"
      >
        <span class="entry-icon"><AppIcon :name="item.icon" :size="19" /></span>
        <span class="entry-main">
          <span class="entry-name">{{ item.name }}</span>
          <span class="entry-sub">{{ item.sub }}</span>
        </span>
        <AppIcon name="chevron" :size="17" class="entry-arrow" />
      </button>
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

.group-title {
  font-size: var(--fs-note);
  color: var(--dim);
  font-weight: var(--w-strong);
  margin: 2px 2px 8px;
}

/* ---- 内联本命牌 ---- */
.birth-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.reset {
  font-size: var(--fs-note);
  color: var(--dim);
  padding: 2px 4px;
}

.birth-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 2px 2px 4px;
}

.birth-imgs {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.birth-img-btn {
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--t-press) var(--ease-out);
}

.birth-img-btn:active {
  transform: scale(0.96);
}

.birth-img {
  display: block;
  width: 62px;
  aspect-ratio: 500 / 839;
  border-radius: var(--radius-img);
  object-fit: cover;
  box-shadow: var(--shadow-card);
}

.birth-img.ph {
  background: var(--sunk);
}

.birth-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.birth-names {
  font-size: var(--fs-head);
  font-weight: var(--w-strong);
  color: var(--gold-text);
  line-height: 1.5;
}

.birth-sub {
  font-size: var(--fs-note);
  color: var(--dim);
}

.birth-lead {
  font-size: var(--fs-note);
  color: var(--dim);
  line-height: 1.7;
  margin: 0 2px 10px;
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

.entry {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 6px;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.entry:active {
  background: var(--sunk);
}

.entry-divide {
  border-top: 1px solid var(--line);
  border-radius: 0;
}

.entry-icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--gold-soft);
  color: var(--gold-text);
}

.entry-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.entry-name {
  font-size: var(--fs-body);
  font-weight: var(--w-strong);
}

.entry-sub {
  font-size: var(--fs-note);
  color: var(--dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-arrow {
  color: var(--dim);
  flex-shrink: 0;
}
</style>
