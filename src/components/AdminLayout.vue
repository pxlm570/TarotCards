<script setup>
// 站长台布局壳（2026-09-28 admin 区拆分）：顶栏品牌 + 三个独立链接的导航
// （/admin 数据看板、/admin/config AI 配置、/admin/invites 邀请码管理），
// 子页面各自向服务端 owner 门禁取数，本壳不含权限逻辑。
// 版式参照 Sakai（MIT，primefaces/sakai-vue）的管理台结构，配色走本项目 tokens。
// 入口收口（2026-09-29）：非站长打开 /admin 直接弹回应用首页，不渲染空壳
// （数据本就被服务端 owner 门禁 403 挡住，这里只是不给他们看空态页）。
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { watchEffect } from 'vue'
import AppIcon from './AppIcon.vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const router = useRouter()
watchEffect(() => {
  if (auth.state === 'active' && !auth.owner) router.replace('/')
})
</script>

<template>
  <div v-if="auth.owner" class="adm-shell">
    <header class="adm-topbar">
      <div class="adm-brand">
        <AppIcon name="star" :size="18" />
        <span>星语站长台</span>
      </div>
      <nav class="adm-nav" aria-label="站长导航">
        <RouterLink to="/admin" exact-active-class="adm-on">数据看板</RouterLink>
        <RouterLink to="/admin/config" exact-active-class="adm-on">AI 配置</RouterLink>
        <RouterLink to="/admin/invites" exact-active-class="adm-on">邀请码</RouterLink>
      </nav>
      <RouterLink to="/" class="adm-exit">返回应用</RouterLink>
    </header>
    <main class="adm-main">
      <RouterView />
    </main>
  </div>
</template>

<style>
/* 站长台共享样式（.adm- 前缀命名空间）：三页共用的卡片/表格/状态类只定义一次。
   非 scoped——本壳只在 /admin 路由下加载，类名带前缀不与主站冲突。 */
.adm-shell { min-height: 100vh; min-height: 100dvh; background: var(--bg); }
.adm-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 18px;
  /* 宽屏时与 1080px 内容容器对齐（min() 兜底窄屏） */
  padding: 12px max(20px, calc((100% - 1080px) / 2));
  background: var(--surface);
  border-bottom: 2px solid var(--line);
}
.adm-brand {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--gold-text);
  font-family: var(--serif);
  font-weight: var(--w-strong);
  letter-spacing: .08em;
  white-space: nowrap;
}
.adm-nav { display: flex; gap: 4px; flex: 1; overflow-x: auto; }
.adm-nav a {
  padding: 7px 13px;
  border-radius: 9px;
  color: var(--dim);
  font-size: .875rem;
  font-weight: var(--w-medium);
  white-space: nowrap;
}
.adm-nav a.adm-on { color: var(--gold-text); background: var(--gold-soft); }
.adm-exit { color: var(--dim); font-size: .8125rem; white-space: nowrap; }
.adm-main { max-width: 1080px; margin: 0 auto; padding: 18px 20px 40px; display: grid; gap: 14px; }
@media (max-width: 640px) {
  .adm-topbar { flex-wrap: wrap; gap: 8px 14px; padding: 10px 14px; }
  /* flex:1 的 basis(0%) 会压过 width——用 flex-basis:100% 才能强制导航整行换行 */
  .adm-nav { order: 3; flex-basis: 100%; }
  .adm-main { padding: 14px 14px 32px; }
}

/* 卡片与状态空态 */
.adm-card { background: var(--surface); border: 2px solid var(--line); border-radius: var(--radius-card); padding: 16px; }
.adm-card-title { font-weight: var(--w-strong); color: var(--ink); font-size: .9375rem; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.adm-empty { padding: 36px 16px; text-align: center; color: var(--dim); display: grid; gap: 12px; justify-items: center; }

/* 表格 */
.adm-sheet { overflow-x: auto; }
.adm-sheet table { width: 100%; min-width: 480px; border-collapse: collapse; font-size: var(--fs-note); }
.adm-sheet th { text-align: left; color: var(--dim); font-weight: 500; padding: 6px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
.adm-sheet td { padding: 7px 8px; border-bottom: 1px solid var(--line); color: var(--ink); white-space: nowrap; }
.adm-cell-email { max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
.adm-status { font-size: var(--fs-note); }
.adm-status.redeemed { color: var(--gold-deep); }
.adm-status.available { color: var(--ink); }
.adm-status.expired { color: var(--dim); }
.adm-code-tail { letter-spacing: .06em; color: var(--dim); }

/* 表单（AI 配置页） */
.adm-form { display: grid; gap: 12px; }
.adm-form .field-input {
  width: 100%;
  padding: 11px 12px;
  border: 2px solid var(--line);
  border-radius: var(--radius-sm);
  color: var(--ink);
  background: var(--surface);
  font: inherit;
  font-size: 1rem;
}
.adm-field-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 12px; }
@media (max-width: 640px) { .adm-field-grid { grid-template-columns: 1fr; } }
.adm-field { display: grid; gap: 5px; }
.adm-note { color: var(--dim); font-size: var(--fs-note); line-height: 1.6; }
.adm-warn { color: var(--coral); }
.adm-advanced { color: var(--ink); }
.adm-advanced summary { cursor: pointer; color: var(--dim); font-size: var(--fs-note); }
.adm-advanced .adm-field-grid { margin-top: 10px; }
</style>
