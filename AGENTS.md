# AGENTS.md

指导 ZCode agent 在本仓库工作。项目：**星语塔罗** — 移动端优先的塔罗 PWA（Vue 3 + Vite + Pinia），纯静态、无后端、无账号，数据全存本机，部署 GitHub Pages。全部 UI 内容为中文。

> 有一份更详尽的历史指引 `CLAUDE.md`（本地磁盘、不入 git）。它由旧工具链维护、可能过时，以本文件 + 设计文档为准。

## 命令

```bash
npm run dev       # Vite 开发服务器（手机预览加 -- --host）
npm run build     # 生产构建（含 PWA 离线缓存）
npm run preview   # 预览构建产物
npm test          # vitest run（没有 "vitest" npm script，别用 npm run vitest）
npx vitest run tests/engine.spec.js   # 单文件测试
```

- CI（`.github/workflows/deploy.yml`）：推 `master` 自动 测试→构建→部署 GitHub Pages。
- Vite 固定在 v7（为兼容 vitest 曾降级，升级前先验证 vitest）；vitest 配置 `pool:'threads', isolate:false` 是有意的，勿改回。
- E2E：`scripts/e2e-flow.py`，跑前设 `$env:PLAYWRIGHT_BROWSERS_PATH='D:\claude-tools\ms-playwright'`。
- **preview 端口坑**：上一轮 preview 进程常残留占住 4173/4174，新起 vite 会自动换端口导致对着旧服务器测/截图。反常结果先查监听端口并 kill；起服务加 `--strictPort`。

## 架构与关键约定

- **内容与代码分离**：内容全是 JSON，代码只渲染。`src/data/cards.json`（78 牌，**牌 id 是全局契约**：`major-00…21`、`wands|cups|swords|pentacles-01…14`）、`src/data/spreads.json`、`public/decks/<皮肤id>/`（皮肤包，须注册进 `public/decks/index.json`）。
- **路由是 hash 模式**（createWebHashHistory）——GitHub Pages 子路径下 HTML5 history 刷新会 404。`vite.config.js` 的 `base:'/TarotCards/'` 与仓库名绑定（改名需同步）。
- **占卜动线是 Pinia 状态机**（`src/stores/reading.js`）：`idle→spreadSelected→breathing→questioning→shuffling→picking→revealing→interpreting`；流程态持久化到 **sessionStorage** `tarot.flow.v1`。
- **取牌面图只走 `src/lib/deck-loader.js`**，URL 必须用 `import.meta.env.BASE_URL` 前缀——硬编码 `/decks/...` 部署子路径后全 404。
- **随机**（`src/lib/tarot-engine.js`）：`crypto.getRandomValues` + 拒绝采样 + Fisher-Yates（直接取模会偏置）。
- localStorage 读写必须走 `src/lib/storage.js` 的 `safeGetItem/safeSetItem`（iOS 阻止 Cookie 时裸用抛 SecurityError）；key 统一命名空间 `tarot.<name>.v1`。
- 触感走 `lib/feedback.js` 的 `tap()/success()`，轻提示 `toast()`；勿裸用 `navigator.vibrate`。

## 兼容性红线

- 不用正则 lookbehind（Safari ≤16.3 炸）。
- textarea/input 字号 ≥16px（iOS 聚焦自动放大）。
- 主题令牌全在 `src/styles/tokens.css`，颜色/字体/圆角只引用 token；不引 Google Fonts（国内网络 + PWA 离线不可靠）。

## 测试纪律

- 改 `src/data/*.json` 必须跑 `npm test`——测试是数据契约的守卫。
- 引擎/store/数据校验类任务严格 TDD：先写失败测试再实现。

## 当前实现状态（2026-08 走查）

- **M1 + M1.5 已完成**；**M2 学习系统已落地**（M3-M5 未开始）：
  - 课程：`src/data/courses/chapter-01..07.json` + `index.json`；lesson 类型 `article/flashcards/quiz/practice`；正文全中文（`tests/courses.spec.js` 拒绝英文混排）。
  - 学习 store：`src/stores/learning.js`，key `tarot.learning.v1`，含 `progress/unlocked/reviewLog/totalReviews/sr`（SR 状态按卡存 `{ease,interval,due,reps}`）；`completeLesson` 整章完成解锁下一章 + 触发成就。
  - 成就：`src/stores/achievements.js` + `src/data/achievements.json`，key `tarot.achievements.v1`，`AchievementToast.vue` 已挂 App.vue；`first-reading`/`streak-7` 留待 M3 触发。
  - `src/lib/day-key.js`（凌晨 4 点分界）供 M3 连胜复用；实战课完成走 `src/lib/practice.js` 的 sessionStorage 标记，解读页挂载时消费。
  - 皮肤切换：`useDeck().switchDeck(id)`（写 `settings.deckId` 并重载 manifest），牌库页已用。

## 必读文档（动敏感区前）

- 设计定稿（信息架构/动线/视觉系统/§8 视觉规范）：`docs/plans/2026-07-25-tarot-tool-design.md`
- 里程碑实施计划：`docs/plans/2026-07-25-tarot-m*-implementation-plan.md`；M1 交接偏差清单：`docs/plans/2026-07-26-m1-handoff.md`
- 注意：`docs/`、`CLAUDE.md`、`.workbuddy/` **不入 git**（已 gitignore），只存本地，改了无法也不应 commit。
