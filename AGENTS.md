# AGENTS.md

本文件是**唯一**的 AI 工作指令（整合了原 CLAUDE.md）。项目：**星语塔罗** —— 移动端优先的塔罗 PWA（Vue 3 + Vite + Pinia），纯静态、无后端、无账号，数据全存本机，部署 GitHub Pages，全部 UI 为中文。

> 旧文档已归档到 `docs/archive/`（见其 README 索引），只作历史，不作为执行依据。若归档文档与现代码冲突，**以代码为准**。

## 指令与仓库约定

- 指令/规划类文档只保留 `AGENTS.md` 一份在库；`docs/`（含 archive）、`.workbuddy/`、`.zcode/`、`CLAUDE.md`（已移入 archive）**都不入 git**，仅存本地——改它们直接改文件即可，不 commit。
- 远端仓库 `https://github.com/pxlm570/TarotCards` 只含代码与素材，已转公开并自动部署（push `master` 触发测试→构建→发布）。
- 提交信息风格：`feat:`/`fix:`/`chore:`/`docs:`/`test:` + 中文描述。

## 命令

```bash
npm run dev       # Vite 开发服务器（手机预览加 -- --host）
npm run build     # 生产构建（含 PWA 离线缓存）
npm run preview   # 预览构建产物
npm test          # vitest run（没有 "vitest" npm script，别用 npm run vitest）
npx vitest run tests/<file>.spec.js   # 单文件测试
```

- Vite 固定在 v7（为兼容 vitest 曾降级，升级前先验证）；vitest 配置 `pool:'threads', isolate:false` 是有意的，勿改回（本机高负载下 forks 会超时）。
- E2E：`scripts/e2e-flow.py`（需本机 Playwright 环境）。
- **preview 端口坑**：旧 preview 进程常残留占住 4173/4174，新起 vite 自动换端口导致对着旧服务器测试/截图。反常结果先查监听端口并 kill；起服务加 `--strictPort`。

## 里程碑状态

- ✅ **M1~M5 全部完成并上线**（v1.0）：
  - M1 占卜主流程、M1.5 视觉改版、M2 学习系统、M3 记录与留存、M4 AI 增强、M5 打磨扩展 均落地。
  - M3：占卜自动落库 `tarot.journal.v1`（`readings[]`+`dailyDraws{}`，上限 500 淘汰最旧）、记录时间线/详情、每日一抽+连胜（`lib/streak.js`+`lib/day-key.js` 凌晨 4 点）、XP 22 级（`lib/xp.js`+`stores/profile.js`，key `tarot.profile.v1`）、Mirror（`lib/mirror.js`）、本命牌（`lib/birth-cards.js`）、数据导出导入（`lib/backup.js`）。
  - M4：`stores/settings.js` + `lib/ai-client.js`（SSE 流式）+ `lib/ai-prompts.js`（6 场景+人格+安全边界）；解读页深度解读/追问/我先解、提问澄清、学习助教、Mirror 复盘、首页 AI 问候；`#import=` 配置分享链接已实装。
  - M5：动效/字号开关、分享卡片（`lib/share-card.js`+`ShareCardModal`）、PWA 安装引导、仪式牌阵（new-moon/full-moon/birthday 数据已入 spreads.json，生日窗口置顶）、rws-sepia 皮肤管线验证（`scripts/gen-rws-sepia.py`）。
- 占卜动线落库衔接：`stores/reading.js` 有 `journalId`/`isDaily`（随 flow 持久化），`InterpretationView` 挂载自动存一条、`?daily=1` 打卡。

## 架构与关键约定

- **内容与代码分离**：内容全是 JSON，代码只渲染。`src/data/cards.json`（78 牌，**牌 id 是全局契约** `major-00…21`、`wands|cups|swords|pentacles-01…14`）、`src/data/spreads.json`、`src/data/courses/`、`public/decks/<皮肤id>/`（皮肤包须注册进 `public/decks/index.json`）。
- **路由是 hash 模式**（createWebHashHistory）——GitHub Pages 子路径下 HTML5 history 刷新会 404。`vite.config.js` 的 `base:'/TarotCards/'` 与仓库名绑定。
- **占卜动线是 Pinia 状态机**（`src/stores/reading.js`）：`idle→spreadSelected→breathing→questioning→shuffling→picking→revealing→interpreting`；流程态持久化 sessionStorage `tarot.flow.v1`。
- **取牌面图只走 `src/lib/deck-loader.js`/`use-deck.js`**，URL 必须带 `import.meta.env.BASE_URL` 前缀——硬编码 `/decks/...` 部署子路径全 404。皮肤切换用 `useDeck().switchDeck(id)`（写 `settings.deckId` 并重载）。
- **随机**（`src/lib/tarot-engine.js`）：`crypto.getRandomValues` + 拒绝采样 + Fisher-Yates。
- localStorage 读写走 `src/lib/storage.js` 的 safe 封装，key 统一 `tarot.<name>.v1`；零散标记位也须走 safe 封装（iOS 阻止 Cookie 时裸用抛 SecurityError）。
- 触感走 `lib/feedback.js` 的 `tap()/success()`，轻提示 `toast()`；勿裸用 `navigator.vibrate`。

## 视觉与反馈

- 双主题：浅色默认 + 暗夜可选，`settings.theme` 三态 `auto`（默认，跟随系统）/`light`/`dark`；`index.html` 内联脚本定首帧主题防白闪。
- 设计令牌全在 `src/styles/tokens.css`，组件基类在 `src/styles/components.css`（`.btn-solid/.btn-ghost/.card/.card-press/.chip/.badge`），新页面直接用基类 + `AppIcon.vue`，别各写各的。
- **金色纪律**：金只给「行动/荣誉/当前项」；**紫色永久废除**；不用 emoji 当功能图标。
- 动效原语 `.pop/.glow-pulse/.stagger-item/.is-loading`；降级看 `<html data-motion>` 与 `prefers-reduced-motion`。
- 视觉规范细节见设计文档 §8：`docs/plans/2026-07-25-tarot-tool-design.md`。

## 兼容性红线

- 不用正则 lookbehind（Safari ≤16.3 炸）。
- textarea/input 字号 ≥16px（iOS 聚焦自动放大）。
- 只引用 token，不引 Google Fonts（国内网络 + PWA 离线不可靠）。

## PWA 与部署

- vite-plugin-pwa 的 `devOptions` 保持关闭（dev 下 SW 缓存干扰调试）。
- **部署后看到旧界面 ≠ 部署失败**：SW 离线优先，旧 SW 给预缓存。已由 `lib/sw-refresh.js` 根治（新 SW 接管自动刷一次，输入中跳过）。排查顺序：先 curl 线上 index.html 对比 dist bundle hash。

## AI 集成边界（M4）

- OpenAI 兼容协议 + SSE 流式，baseUrl/model/key 全由用户在设置页配置，**不做官方端点绑定**；无 key 时产品 100% 完整可用，AI 入口优雅降级。
- AI 不给医疗/法律/财务决定性建议。
- `docs/archive/CLAUDE.md`（原 local-secrets 说明）中的 bytecatcode key **仅限开发期生图**，不进入产品代码。

## 测试纪律

- 改 `src/data/*.json` 必须跑 `npm test`——测试是数据契约的守卫（含课程内容全中文校验）。
- 引擎/store/数据校验类任务严格 TDD：先写失败测试再实现。

## 必读文档

- 产品设计定稿（信息架构/动线/内容/视觉 §8）：`docs/plans/2026-07-25-tarot-tool-design.md`
- 历史留档（只读，别当依据）：`docs/archive/README.md`
- ⚠️ M3-M5 已按计划完成；计划文档（`docs/plans/2026-07-25-tarot-m{3,4,5}-implementation-plan.md`）中除「月相牌阵需权威日历核实」与「连胜里程碑牌背 UI」两项外均已落地（见仓库收尾时向用户提出的决策项）。
