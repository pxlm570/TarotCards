<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { markVisited } from '../router/index.js'
import AppIcon from '../components/AppIcon.vue'

const router = useRouter()
const step = ref(0)

const screens = [
  {
    icon: 'reading',
    title: '你的私人塔罗空间',
    body: '占卜、学习、记录，都在这里。不用注册不用登录，所有数据只保存在这台设备上。'
  },
  {
    icon: 'moon',
    title: '七步仪式，不止是抽牌',
    body: '选牌阵 → 静心 → 提问 → 洗牌 → 抽牌 → 翻牌 → 解读。每一步都有仪式感，慢慢来。'
  },
  {
    icon: 'learn',
    title: '从零学会塔罗',
    body: '7 章新手课程配闪卡与实战，学占卜像闯关。牌意看不懂时，随时点进牌库百科。'
  }
]

function next() {
  if (step.value < screens.length - 1) {
    step.value++
  } else {
    markVisited() // 存储不可用时有会话级内存兜底，不会锁死在引导页
    router.replace('/')
  }
}
</script>

<template>
  <div class="welcome">
    <div class="screen">
      <div class="icon">
        <AppIcon :name="screens[step].icon" :size="44" />
      </div>
      <h1 class="title">{{ screens[step].title }}</h1>
      <p class="body">{{ screens[step].body }}</p>
    </div>

    <div class="footer">
      <div class="dots">
        <span v-for="(s, i) in screens" :key="i" class="dot" :class="{ on: i === step }" />
      </div>
      <button class="next btn-solid btn-block" @click="next">
        {{ step < screens.length - 1 ? '下一步' : '开始体验' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 48px 32px calc(48px + env(safe-area-inset-bottom, 0px));
}

.screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 20px;
}

.icon {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: var(--gold-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  color: var(--gold-text);
}

.title {
  font-size: var(--fs-title);
  letter-spacing: 0.04em;
}

.body {
  color: var(--dim);
  font-size: var(--fs-body);
  line-height: 1.9;
  max-width: 300px;
}

.footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-3);
}

.dots {
  display: flex;
  gap: var(--sp-1);
}

/* 当前页点 = 当前项，金色；未到的用中性描边色 */
.dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--line);
  transition: background var(--t-fast), width var(--t-fast) var(--ease-out);
}

.dot.on {
  width: 22px;
  background: var(--gold);
}

.next {
  max-width: 320px;
}
</style>
