<script setup>
// 复习页：默认复习到期闪卡；毕业后可复习全库 78 张。
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import cardsData from '../../data/cards.json'
import { useLearningStore } from '../../stores/learning.js'
import FlashcardSession from '../../components/FlashcardSession.vue'
import AppIcon from '../../components/AppIcon.vue'
import { useBack } from '../../composables/use-back.js'

const route = useRoute()
const learning = useLearningStore()
const goBack = useBack()

const allMode = route.query.all === '1'
const allIds = cardsData.map((c) => c.id)

// 全库复习：毕业解锁后，或主动带 all=1；否则复习到期卡。
// due 列表进页时定格一次快照（评审 2026-09-03）：评分会改 sr 让实时列表收缩，
// 若作为 computed 传入会话并以其拼 key，每评一张就整场 remount（进度归零、again 卡消失）。
const cardIds = allMode || learning.graduated ? allIds : learning.dueFlashcards().map((c) => c.id)
const title = computed(() => (allMode || learning.graduated ? '全库复习' : '今日复习'))
</script>

<template>
  <div class="review">
    <header class="head">
      <button class="back btn-text" @click="goBack('/learn')">
        <AppIcon name="arrow" :size="16" style="transform: rotate(180deg)" />
        学习
      </button>
      <h1 class="title">{{ title }}</h1>
      <p class="sub">{{ cardIds.length }} 张</p>
    </header>

    <FlashcardSession v-if="cardIds.length" :key="cardIds.join(',')" :card-ids="cardIds" />
    <div v-else class="empty card">
      <AppIcon name="check" :size="22" />
      <p>今天没有到期的卡牌，明天再来巩固吧。</p>
      <button class="btn-ghost" @click="goBack('/learn')">返回</button>
    </div>
  </div>
</template>

<style scoped>
.review {
  padding: var(--sp-3) 20px calc(40px + env(safe-area-inset-bottom, 0px));
}

.head {
  margin-bottom: var(--sp-3);
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-left: 0;
  margin-bottom: 8px;
}

.title {
  font-size: var(--fs-title);
}

.sub {
  font-size: var(--fs-note);
  color: var(--dim);
}

.empty {
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  color: var(--dim);
}
</style>
