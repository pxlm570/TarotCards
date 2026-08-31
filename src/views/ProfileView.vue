<script setup>
// 「我的」主页（v1.5 收缩重构，2026-08-31 用户反馈：功能栏太多）：
// 只保留 XP 条 + 分组条目列表，每项点击进独立详情页详细选择（/profile/*）。
// 本命牌按用户要求排在最上（原在「外观」之下）。
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { loadSettings } from '../lib/storage.js'
import { useProfileStore } from '../stores/profile.js'
import { birthCards } from '../lib/birth-cards.js'
import { version } from '../../package.json'
import XpBar from '../components/XpBar.vue'
import AppIcon from '../components/AppIcon.vue'
import { tap } from '../lib/feedback.js'

const router = useRouter()
const profile = useProfileStore()
const settings = loadSettings()

const THEME_LABEL = { auto: '跟随系统', light: '浅色', dark: '暗夜' }

const birth = computed(() => {
  if (!profile.birthday) return null
  const [y, m, d] = profile.birthday.split('-').map(Number)
  return birthCards(y, m, d)
})

// 条目摘要即时反映当前设置（详情页改完返回，主页重挂载即读到新值）
const groups = computed(() => [
  {
    title: '个人',
    items: [
      {
        to: '/profile/birth',
        icon: 'moon',
        name: '本命牌',
        sub: birth.value ? `人格 / 灵魂 · ${birth.value.display}` : '输入生日，找到属于你的牌'
      },
      { to: '/collection', icon: 'star', name: '收藏馆', sub: '牌面收集与鉴赏' }
    ]
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
