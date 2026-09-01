<script setup>
// 首页 hero 样张共用下半区（仅预览）：静态演示数据（连胜 6/最佳 12、复习 0/3），
// 按钮只保留视觉反馈，不触发真实行动。
import AppIcon from '../AppIcon.vue'
import { tap, toast } from '../../lib/feedback.js'

defineProps({
  drawn: { type: Boolean, default: false },
  dailyRow: { type: Boolean, default: false },
  faceUrl: { type: String, default: '' }
})

// 样张按钮不触发真实行动：轻提示说明这是预览
function demo(msg) {
  tap()
  toast(`样张预览 · ${msg}`)
}
</script>

<template>
  <div class="blocks">
    <div class="cta-block">
      <button type="button" class="cta btn-solid" @click="demo('「开始占卜」在定稿后的正式首页可用')">
        <AppIcon name="reading" :size="20" />
        开始占卜
      </button>
    </div>

    <section class="goals card">
      <p class="goals-title">今日小目标</p>
      <div class="goal">
        <span class="goal-dot" :class="{ done: drawn }"><AppIcon :name="drawn ? 'check' : 'star'" :size="14" /></span>
        <span class="goal-text">抽 1 张牌</span>
      </div>
      <div class="goal">
        <span class="goal-dot"><AppIcon name="deck" :size="14" /></span>
        <span class="goal-text">复习 0/3 张闪卡</span>
      </div>
    </section>

    <button v-if="dailyRow" type="button" class="daily card-press" :class="{ done: drawn }" @click="demo('每日一抽入口，正式首页可抽牌')">
      <img v-if="drawn && faceUrl" class="daily-thumb" :src="faceUrl" alt="星辰" />
      <span v-else class="daily-icon"><AppIcon name="star" :size="26" /></span>
      <span class="daily-main">
        <b>{{ drawn ? '今日已抽 · 星辰' : '每日一抽' }}</b>
        <span class="daily-sub">{{ drawn ? '点击回看今天的指引' : '抽一张牌，与今天的自己对话' }}</span>
      </span>
      <span class="daily-streak">
        <span class="streak-n">6</span>
        <span class="streak-label">天连胜</span>
      </span>
    </button>
    <p class="streak-meta">
      <template v-if="drawn">今日已打卡</template>
      <template v-else>连续打卡，积累你的仪式感</template>
      · 历史最佳 12 天
    </p>

    <section class="learn-entry">
      <router-link to="/learn" class="learn-card card-dashed">
        <AppIcon name="learn" :size="22" />
        <span class="learn-text"><b>从零学塔罗</b> · 7 章新手课程</span>
      </router-link>
    </section>
  </div>
</template>

<style scoped>
/* ---- 以下样式与正式首页保持一致的视觉规格，仅服务于样张预览 ---- */
.cta-block {
  margin-bottom: var(--sp-3);
}

.cta {
  width: 100%;
  padding: 16px;
  font-size: var(--fs-head);
}

.goals {
  padding: 14px 16px;
  margin-bottom: var(--sp-3);
}

.goals-title {
  font-size: var(--fs-note);
  font-weight: var(--w-strong);
  color: var(--gold-text);
  margin-bottom: 8px;
}

.goal {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.goal-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sunk);
  color: var(--dim);
}

.goal-dot.done {
  background: var(--gold-soft);
  color: var(--gold-text);
}

.goal-text {
  font-size: var(--fs-body);
  color: var(--dim);
}

.daily {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 16px;
  margin-bottom: 8px;
  background: var(--gold-soft);
  border-color: var(--gold-deep);
}

.daily-icon {
  color: var(--gold-text);
}

.daily-thumb {
  width: 52px;
  aspect-ratio: 500 / 839;
  border-radius: var(--radius-img);
  object-fit: cover;
  box-shadow: var(--shadow-card);
  flex-shrink: 0;
}

.daily-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.daily-main b {
  font-size: var(--fs-head);
  color: var(--gold-text);
}

.daily-sub {
  font-size: var(--fs-note);
  color: var(--dim);
}

.daily-streak {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--gold-text);
}

.streak-n {
  font-size: 1.5rem;
  font-weight: var(--w-title);
  line-height: 1;
}

.streak-label {
  font-size: 0.6875rem;
  color: var(--dim);
}

.streak-meta {
  font-size: 0.75rem;
  color: var(--dim);
  text-align: center;
  margin-bottom: var(--sp-3);
}

.learn-entry {
  margin-top: var(--sp-4);
}

.learn-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 16px;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: var(--w-medium);
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--t-press) var(--ease-out), border-color var(--t-press);
}

.learn-card:active {
  transform: scale(0.98);
  border-color: var(--gold-deep);
}

.learn-text b {
  color: var(--ink);
  font-weight: var(--w-title);
}
</style>
