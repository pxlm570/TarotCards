# AGENTS.md

本文件是**唯一**的 AI 工作指令（整合了原 CLAUDE.md）。项目：**星语塔罗** —— 移动端优先的塔罗 PWA（Vue 3 + Vite + Pinia），纯静态、无后端、无账号，数据全存本机，部署 GitHub Pages，全部 UI 为中文。

> 旧文档已归档到 `docs/archive/`（见其 README 索引），只作历史，不作为执行依据。若归档文档与现代码冲突，**以代码为准**。

## 指令与仓库约定

- 指令/规划类文档只保留 `AGENTS.md` 一份在库；`docs/`（含 archive）、`.workbuddy/`、`.zcode/`、`CLAUDE.md`**都不入 git**，仅存本地——改它们直接改文件即可，不 commit。根目录 `CLAUDE.md` 现为本地 Claude Code 专属补充桩（`@AGENTS.md` 引用本文件，旧全文已入 `docs/archive/`）；修订通用约定只改本文件，别动桩。
- 远端仓库 `https://github.com/pxlm570/TarotCards` 只含代码与素材，已转公开并自动部署（push `master` 触发测试→构建→发布）。
- **推送策略（2026-08 用户定，取代此前「绝不 push」规则）**：允许执行代理 push，但**每次 push 前必须征得用户同意或等用户明确指令**，不得擅自推送。
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
- **v1.0 后追加（2026-08，验收收尾）**：牌面/牌背分离自由组合（`public/backs/` 独立注册表 + `switchFace/switchBack`）、洗牌双模式（互动拖洗 / 仪式翻洗 + 切换键）、每日挑战（低调可选 +10XP）、测验四题型（单选/多选/看图认牌/正逆判断 + 无限重试）、返回手势逐级回退（`reading.stepBack` + App.vue 全局 popstate 处理，pushState 保留基路径与 hash）、AI 客户端 Anthropic 协议支持（baseUrl 含 `/anthropic` 自动走 `/v1/messages`）。
- 裁决记录（2026-08-13，用户拍板）：**默认 AI 端点恢复留空**（回归定稿「不做官方端点绑定」），mimo 移入设置页「快捷填充」下拉（只帮填 baseUrl）；**音效暂缓为备选**——未实装、未删 `settings.sound` 字段，进 v1.5 backlog（产品安静定位，音效与深夜使用场景相悖，可能后续再做）。
- ✅ **v1.1.0（2026-08-15，用户试用反馈迭代）**：选牌阵独立页 `/spreads`（首页仪表盘化：问候+每日一抽+「开始占卜」CTA+今日小目标；仪式日在 CTA 下方出「今日限定」提示行直达）、仪式日判定抽成 `composables/use-ritual-today.js`（生日窗口修复：按当年归一 ±3 天、跨年/闰年边界有测试；**修复前生日置顶是死逻辑**）、选牌改内联选中态+底部确认栏（弹窗全部移除，翻牌点击直翻）、动线五页左上角纯图标退出（`FlowExit.vue`，中途确认/解读页免确认+防丢草稿）、AI 占卜师技艺层（`lib/ai-craft.js`，人格差异以其为唯一源）、返回手势只在动线内接管（afterEach 记来源页）。验收档案：`docs/plans/2026-08-13-v1.0-acceptance-handoff.md`（本地，Task 1–21 已归档）。
- **v1.5 进行中（2026-08-17 起，Task 1–10 已全部完成，待用户验收/决定 push）**：
  - 已提交：AI 提示词按场景裁剪（clarify/tutor/recap 不注方法论）+ 首页问候随人格；仪式提示跨凌晨 4 点自动换日（`composables/use-day-key.js` 响应式单例）；FlowExit 六分支测试 + 选牌中途放入降为轻触感；四季仪式牌阵（节气日期双源核实+北京时跨日边界，置顶优先级 生日>四季>月相）；自定义牌阵数据层与画布编辑器（`lib/custom-spreads.js`，key `tarot.custom-spreads.v1`，上限 20，id 强制 `custom-` 前缀防撞，路由 `/spread-editor`）；占卜动线接入自定义牌阵（静态+自定义合并注册表、选牌阵页「我的牌阵」分组、删阵后 flow 兜底）；自由摆放抽牌（翻牌后拖位+存为我的牌阵）+ 数字键选牌视口跟随 + 自定义牌阵直链校验（8cfa732）。
  - ✅ Task 8 收藏馆已落地（2026-08-18）：`/collection`（`views/CollectionView.vue` + `lib/collection-stats.js`）三块内容（收集墙 78 格点亮+次数角标/皮肤墙/牌背墙连胜解锁梯度）+「我的」与牌库页双入口，不占 TabBar；统计从 journal readings 聚合、纯函数零新增存储。浏览器全链路走查通过（空态灰锁、真实每日一抽后点亮、鉴赏跳转 `/deck/:id`、FlowExit 免确认返回）。**坑：牌库页入口勿用 float 布局**--会被下方 relative 的搜索框盖住点不到，已改 flex title-row。
  - ✅ Task 9 皮肤包已落地（2026-08-18）：`neon-glow`「绚烂霓虹」（霓虹风，22 大牌 gpt-image-2 生图 + 56 小牌 PIL 霓虹构图 + AI 牌背）；管线 `scripts/gen-deck-ai.py`（key 走环境变量/`.workbuddy/local-secrets.md`，绝不入库；可断点续跑）。**坑：bytecatcode 代理有 CF 指纹拦截，Python urllib 直连 403/1010，须走 curl 子进程**；恶魔(major-15) 提示词含「锁链+被俘者」会被内容安全误拦，已改写为装饰性意象。
  - **追加（2026-08-18 用户反馈）**：用户认为霓虹风≠赛博朋克 2077 塔罗壁画风，绚烂霓虹保留但需另做一套对标 CP2077 原版塔罗（扁平插画/粗描线/限定霓虹色/街头壁画感）的皮肤；**设计类任务新约定：先出 2–3 张样张给用户定风格，确认后再做全量**（已写入本条约定）。
  - ✅ **致敬夜之城全套 78 张 AI 卡面定稿（2026-08-22~24，多轮目验迭代）**：56 小牌全部由 PIL 模版升级为 AI 生成（皇帝大牌统一锚定画风+文字驱动构图）。流程：四王三稿（一稿各王原画锚点被用户判「太相似」→二稿换皇帝锚点→三/四稿按权杖国王成功配方重写题材）；小牌样张 6 张定路线（丰碑/场景/阵列/叙事四类构图+宫廷配方）→全量 46 张→用户过数**八轮返修**（数字牌计数是硬仗）。**AI 数数教训**：`N 排 × M 把=共 K`算术式写法+「画面中不得有其他」封口仍不够；**人物各持一物/散飞物必数错**（权杖六随行持杖、权杖八飞行、圣杯九架上弧排、星币七藤花各返工 3+ 轮），**插排/网格/单行直排是可靠模式**（宝剑十两排五、宝剑九 3x3、星币九珠宝 3x3 一次过）；同构图连错时**恢复用户认可的原始提示词摇多版挑选**比加约束有效（星币七终用此法，加约束反而画风跑偏被用户退回）。**星币 8/9 换名**：原 9 图画有 8 枚且画面好，用户裁定直接定名为 8，9 另绘珠宝店九宫格。风格标杆=权杖国王+宝剑 A；全卡面零文字（含罗马数字）写进管线 TAIL。**坑：生图代理 2026-08-22 起响应格式漂移**（b64_json ↔ 托管 URL 随机），`edits_gen` 已兼容双格式（URL 先直连后走代理下载）。
  - ✅ 夜城壁画已落地（2026-08-19，`night-mural`）：对标 CP2077 原版塔罗壁画的**二创**皮肤。流程：三轮样张（文字提示词→参考图直绘→三模式 C1叙事/D1远景/E2剪影嵌灯火）→用户确认「整套统一 C1、D1 作取景选项」→ 22 大牌走 `scripts/gen-mural.py`（edits 参考图模式，每张以自己的游戏原画作画风锚点+构图重写）+ 56 小牌 PIL 扁平壁画（近黑底+血红框+花色模版印双层）+ AI 牌背。**护栏：与原画的结构相似度（16x32 灰度相关）须 ≤+0.30（复制级≈+0.37），越界自动重生成**；倒吊人题材指标天然下限 +0.33，边缘保留待用户目验。**坑：生图参考图本身含暴力元素会被内容安全拦（轮子弹孔/倒吊人/恶魔脸），换干净参照图（隐士）即可**；「倒挂/悬挂」字样易触发自残误判，改「冥想漂浮」措辞。整套生成前必须经用户确认（用户 2026-08-19 明确要求）。
  - **用户反馈迭代（2026-08-19/20）**：皮肤更名「致敬夜之城」；力量重绘（用户反馈原图无力量感，改双手合拢机械狮颚的构图）；**修了全员黑边 bug**（fit_crop 裁宽而非裁高，2:3 图源裁高会 pad 黑边，已全量重裁统一 500x839、牌背 500x878）。牌阵选择指引上线：`spreads.json` 每阵新增 `guide{fit,who,tip}`（数据契约测试守卫）+ 选牌阵页「怎么选牌阵？」底部弹层（12 阵按使用情境三组：日常与状态/事件与抉择/周期与仪式，含提问四原则与三条告诫，组件测试覆盖开合交互）。**修了孤儿牌背 bug（2026-08-20 用户反馈「牌背选择里看不到」）**：牌背选择/牌背墙只读 `public/backs/index.json`，皮肤包自带 `back.webp` 不注册就是死资产（`backImageUrl` 全项目零调用）--已把绚烂霓虹/致敬夜之城两张 AI 牌背注册进牌背注册表，加契约测试守卫（`tests/backs-registry.spec.js`：非遗留皮肤的牌背必须注册），两个生图管线 `register()` 同步注册牌背。

- ✅ **v1.5.0 对抗性审查与修复（2026-08-24）**：三路并行审查（lib+stores / views+components / 数据契约+资产）产出 40+ 实证问题，全部处置。**高危修复**：备份键清单漏 `custom-spreads`/`challenge`（换机丢创作数据）→补齐+坏键跳过+导入 journal 结构校验与 500 上限；`mirror.dailyFreq` 双重减 4 小时（04:00-08:00 窗口频次整体错位）→删手动偏移+边界测试；`stepBack` 重抽后 `journalId` 不失效（记录库存旧牌面）→回退到 picking/shuffling 时删旧记录连带 dailyDraws 引用；皮肤注册表零契约测试→新增 `tests/decks-registry.spec.js`（manifest 存在/78 键全等/文件在盘/cardsFrom 无环）。**中危**：ai-client 超时改流式空闲超时+监听器清理收口 finally（SSE 挂起永久 pending、ProfileView `.next()` 丢 generator 泄漏连接）；ChatStream 卸载中止+失败重试+AbortError 不再报「网络错误」；容量淘汰清 dailyDraws 悬空引用；`completeLesson` XP 幂等（章末课重玩刷分）+成就 id 不再按数组序号拼；RevealView `free.value` 模板笔误（自由摆放指引永不显示）；ReadingDetailView 无效深链空态（原点保存/删除即崩）；MirrorPanel 复盘失败可重试且错误文案不再能存成日记；ShareCardModal 生成失败不再继续下载/分享+卸载回收 blob URL；PracticeLesson 重置进行中局前确认；清空数据走 safeKeys/safeRemoveItem（iOS 阻 Cookie 场景）；App.vue popstate 用 history.state.position 分辨前进/后退（前进被当回退再退一步）；iOS 安装引导改「分享→添加到主屏幕」文案（原为永不生效的死按钮）；牌背墙/每日一抽/时间线/牌阵画布空 src 守卫；toast 增加 warn 档；自定义牌阵 id 防撞+label 限长；settings 逐字段校验坏值回落默认；cardsFrom 环检测；分享卡问题 30 字防截断+toBlob 失败 reject。**配置/资产**：SW 预缓存排除 style-samples（本地构建版权图曾随 SW 分发）+deck-images 缓存 200→400（312 张全量浏览会击穿）；月相/节气数据加**地平线守卫**（到期前一年 CI 转红提醒补数据）；gen-mural FAIL 卡改删除不入库+register 幂等不覆写定稿 manifest+字体查找列表化+四王原画去 `.png.png` 双扩展名；package.json 0.0.0→1.5.0；README 功能清单与实物对齐（12 阵/4 皮肤/收藏馆/自定义牌阵）；`useEscClose`→`use-esc-close` 统一 kebab-case。**遗留 backlog**：gen-mural/gen-deck-ai 两管线抽公共模块（大重构，风险高暂缓）；分享卡占位矩形升级为真牌面缩略图。
  - ✅ **卡背重设计定稿（2026-08-24）**：用户发起致敬夜之城卡背重设计，五轮目验（拟真义眼被否→图标义眼文字重生成跑偏→**改用旧 V2 原图作 img2img 参考局部改绘保真**→三方向候选闭眼/心象/虹膜→R1 同心环徽记定中心→四角花色「小而完整不抢镜」收敛）终稿 W4：中央电路同心环徽记+四角花色小印章（顺时针权杖橙/圣杯品红/宝剑紫/星币金）+花色色域渐变+城市边框。旧八芒星卡背保留注册为独立牌背「夜城星芒」（`backs/night-mural-star.webp`），与新「致敬夜之城」并存可切。**坑**：本轮生图代理响应极不稳（空响应/下载截断频发，疑似限流），逐张 try/except+8s 间隔续跑是正解。
  - ✅ **页面退出统一「从哪进、退回哪」（2026-09-01）**：新增 `composables/use-back.js` 智能返回（`history.state.back` 有来源则 `router.back()`，直链无来源 `replace(fallback)` 防死胡同），二级页（牌详情/学习章节/课时/复习/每日挑战/记录详情/PageHead 详情页）全部接入；`FlowExit` 增 `to`/`fallback` props——动线五页传 `store.entryPath`（**动线前进全是 replace、返回手势会消费入口历史条目，history.back() 回不到入口，必须走持久化入口记忆**）：开局在提问页挂载时捕获 `history.state.back` 存入 flow（`setEntryPath` 恢复中的局不覆盖、reset 清空、随 sessionStorage 防刷新丢失），退出/手势退出/再抽一局都回入口页；收藏馆返回落 `/deck`、选牌阵页复用 FlowExit 智能返回。**顺手修存量 bug**：牌阵编辑器 FlowExit 漏了 `:reset="false"`，退出编辑器会静默作废进行中的一局。测试：`tests/use-back.spec.js` 新建 + flow-exit 扩展 3 例 + store entryPath 持久化/恢复（315 全绿）。**坑**：IAB 里 `window.confirm` 阻塞页面主线程，宿主命令 32s 超时会把阻塞中的脚本作废（接掉对话框也不续跑）——走查带确认框的按钮须预置 `window.confirm=()=>true` 桩；动线退出恢复场景用「预置 flow + 整页直开无 query 提问页」绕开转场冻结走查通过。
    - ✅ **「我的」页本命牌内联化（2026-09-02 用户反馈）**：不单独开页，`/profile/birth` 路由与 BirthView 移除，输入/结果两态直接内联在主页（XP 条下方 card 块：未输入=副文案+日期输入+按钮；已输入=62px 小牌面+牌名+「人格 / 灵魂 · display」+重设，点牌面跳 `/deck/:id` 详情）；「个人」分组仅剩收藏馆。浏览器走查双态通过（1995-06-15 → 单张 隐士·9，顺带覆盖单牌展示）。
  - ✅ **首页 hero 改版定稿「星光牌阵」（2026-09-01）**：用户嫌首页单薄要 hero 冲击感 → 按约定先做三方向样张（星光牌阵/今日之牌/星穹氛围，样张舞台曾临时挂 / 预览）→ 用户选定方案一 → 落地 HomeView：星尘穹顶+五张牌背扇形弧排逐张入场，中央牌即每日一抽入口（未抽=当前牌背+呼吸光晕+连胜徽章（连胜 0 隐藏），已抽=翻正显示当日牌面，点击走原 startDaily 含续局确认/回看逻辑），问候语移至扇形下方，原每日一抽列表行移除（功能并入中央牌）；零新增图片（复用当前皮肤牌背/牌面，换皮肤 hero 随装）；续局横幅/CTA/仪式日/小目标/学习入口全保留，动效走 data-motion/prefers-reduced-motion 降级。样张组件与临时路由已清理。**坑：残留 dev 服务器假死导致用户「效果没变化」误判——预览走查前先确认端口进程真活着（curl 加 --noproxy，本机代理会回 502 干扰判断）**。另：用户问「闪卡」含义（=学习系统复习卡，出牌回忆牌义→翻面自评，入口学习页），是否改叫「牌义卡」待用户拍板。
- ✅ **v1.5 追加迭代（2026-08-31，用户 6 条反馈）**：①每日挑战 5 题→3 题定死（第一章题池恰好 3 道，写 5 文案与实际不符）；②学习页加「认识牌面」入口卡直达牌库（副文案明示「点开任意一张牌看牌义与启示」--入门学习复用牌库页，不另做一套）；③**卡面图 SW 缓存破解根治**：用户报「夜城小牌没更新」而文件早已部署一致，根因是 deck-images 运行时缓存 CacheFirst + 图片 URL 永不变→旧缓存 30 天不失效；修法=manifest 增内容哈希 v（4 皮肤+夜城/绚烂牌背条目已注入），cardImageUrl/standaloneBackUrl 拼 ?v=，两个生图脚本 register() 自动 stamp（重绘后重跑 --register 即换 URL）；契约测试守卫 v 存在；链路闭合靠 manifest.json 在 SW 预缓存（部署即新）+ sw-refresh 自动刷新；④⑤**「我的」页收缩重构**：主页只留 XP 条+三组条目（个人/偏好/数据与关于，每行图标+名称+当前值摘要+箭头），本命牌置顶（用户要求）；详情进 6 个新页 /profile/{birth,appearance,preference,ai,data,about}（懒加载+PageHead 返回头，直链时 replace 回上级防死胡同）。**坑**：IAB 走查时后台标签页 rAF/transitionend 冻结导致 out-in 转场停在离开态--是自动化环境症状非代码 bug（DOM 挂载全部验证正确），走查 hash 路由要整页 goto 或验证 DOM 而非等过渡。

## 架构与关键约定

- **内容与代码分离**：内容全是 JSON，代码只渲染。`src/data/cards.json`（78 牌，**牌 id 是全局契约** `major-00…21`、`wands|cups|swords|pentacles-01…14`）、`src/data/spreads.json`、`src/data/courses/`、`public/decks/<皮肤id>/`（皮肤包须注册进 `public/decks/index.json`）。
- **牌阵注册表 = 静态 + 自定义运行时合并**：静态 `spreads.json` 与用户自定义牌阵（`lib/custom-spreads.js`）在运行时合并；自定义 id 强制 `custom-` 前缀永不撞车，位置 key 统一 `p1..pN`；自由摆放抽牌的布局也经该模块存为「我的牌阵」。
- **路由是 hash 模式**（createWebHashHistory）——GitHub Pages 子路径下 HTML5 history 刷新会 404。`vite.config.js` 的 `base:'/TarotCards/'` 与仓库名绑定。
- **占卜动线是 Pinia 状态机**（`src/stores/reading.js`）：`idle→spreadSelected→breathing→questioning→shuffling→picking→revealing→interpreting`；流程态持久化 sessionStorage `tarot.flow.v1`。
- **取牌面图只走 `src/lib/deck-loader.js`/`use-deck.js`**，URL 必须带 `import.meta.env.BASE_URL` 前缀——硬编码 `/decks/...` 部署子路径全 404。皮肤切换用 `useDeck().switchDeck(id)`（写 `settings.deckId` 并重载）。
- **本地专属皮肤（2026-08-19）**：`listDecks` 会把 `public/decks/local-index.json`（gitignore，不随公开仓分发）与公开注册表合并去重。用途：版权素材（如 CP2077 游戏原画）可做成本机皮肤自用，目录与索引均 gitignore，**绝不 push**；可公开分发的皮肤仍走 `index.json` 正常注册。
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
- ✅ M3-M5 遗留项均已落地：月相牌阵日期已按 NASA+timeanddate 双源核实（db9623d）、连胜里程碑牌背 UI 已实现（ac9514c）。
