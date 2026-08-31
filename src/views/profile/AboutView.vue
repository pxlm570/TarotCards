<script setup>
// 关于页（v1.5「我的」页收缩重构，从主页面迁入）。版本号取 package.json，与应用发布对齐。
import { version } from '../../../package.json'
import PageHead from '../../components/PageHead.vue'

const year = new Date().getFullYear()
</script>

<template>
  <div class="page about">
    <PageHead title="关于" back-to="/profile" back-label="我的" />

    <section class="card block">
      <h2 class="app-name">星语塔罗</h2>
      <p class="ver">v{{ version }}</p>
      <p class="row-hint">私人塔罗空间：占卜、学习、记录。牌面为 Pamela Colman Smith 绘制的韦特塔罗（1909，公有领域）；牌意以《The Pictorial Key to the Tarot》为底本中文自撰。定位为塔罗文化学习与自我探索工具，不提供医疗、法律或财务建议。</p>
      <p class="row-hint">数据全部存在本机浏览器，无账号、无后端。© {{ year }}</p>
      <router-link to="/welcome" class="btn-ghost btn-block" style="margin-top:10px">重看新手引导</router-link>
    </section>
  </div>
</template>

<style scoped>
.about {
  padding: var(--sp-3) 20px var(--sp-4);
}

.block {
  padding: var(--sp-2);
}

.app-name {
  font-size: var(--fs-head);
  text-align: center;
  margin-bottom: 4px;
}

.ver {
  text-align: center;
  font-size: var(--fs-note);
  color: var(--gold-text);
  font-weight: var(--w-strong);
  margin-bottom: 10px;
}

.row-hint {
  font-size: var(--fs-note);
  color: var(--dim);
  line-height: 1.7;
}
</style>
