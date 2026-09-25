# 星语塔罗

私人塔罗空间：占卜 · 学习 · 记录 · AI 增强。移动端优先的 Vue 3 + Vite PWA。占卜记录、学习进度和偏好保存在用户设备；邀请登录、默认 AI 和体验额度由 Vercel Functions + Supabase 提供。

**在线访问**：https://pxlm570.github.io/TarotCards/

## 功能

- **占卜**：16 个牌阵按生活场景分组（做个决定：二选一 / 三选一 / 该不该；日常与状态：单张指引 / 状态体检 / 这周怎么过；看人看事：我们之间 / 时间之流 / 凯尔特十字；周期与仪式：新月 / 满月 / 生日 / 四季节气 7 个仪式阵），「怎么选牌阵」指引，七步仪式动线（静心→提问→洗牌→抽牌→翻牌→解读），互动拖洗 / 仪式翻洗双洗牌模式，正逆位与代抽开关，翻牌后拖位 + 存为「我的牌阵」的自由摆放。
- **自定义牌阵**：画布编辑器自建牌阵（最多 20 个，点画布放牌位 / 拖动调整），与静态牌阵合并进占卜动线。
- **学习**：7 章 39 课成长路径；20 节图文课包含韦特牌面观察、分步讲解、课末练习与即时反馈，接续卡牌间隔复习、四题型测验和实战。闯关解锁，自动推荐下一课，毕业后全库复习，每日挑战。
- **牌库**：78 牌百科，搜索 / 筛选；4 套牌面皮肤（经典韦特 / 复古 Sepia / 绚烂霓虹 / 致敬夜之城）与 9 款牌背自由组合。
- **收藏馆**：收集墙（78 格点亮 + 出现次数）、皮肤墙、牌背墙（连胜解锁梯度）。
- **记录**：每次占卜自动落库，时间线 / 详情 / 日记编辑 / 删除，Mirror 统计面板。
- **留存**：每日一抽 + 连胜打卡、XP 22 级（大阿尔克那命名）、成就、今日小目标、本命牌。
- **AI 增强**：受邀用户可使用项目统一提供的 AI 解读与追问（深度解读每账号每天限一次，共享月预算），三种解读人格可选；自定义模型入口默认隐藏，可经 `VITE_ALLOW_CUSTOM_AI` 开启（OpenAI 兼容端点含 Anthropic 协议，Key 只保存在用户本机）。
- **体验**：浅色 / 暗夜双主题、睡前大字档、减弱动效、分享卡片、PWA 可安装离线、返回手势逐级回退。

## 开发

```bash
npm install
npm run dev      # 开发服务器（手机预览加 -- --host）
npm test         # vitest 单元测试
npm run build    # 生产构建（含 PWA 离线缓存）
```

推送到 `master` 会自动测试、构建并部署到 GitHub Pages。

## Vercel 小范围体验部署

默认 AI 由项目统一提供：所有受邀用户共用站长在后台配置的 OpenAI 兼容模型服务，调用只发生在 Vercel 服务端。模型端点、模型名称和 API Key 都存放在 Supabase 配置表里（对网站访客完全不可读），不写进代码仓库、不下发到浏览器；界面上只显示「AI 解读 / 深度解读」，不出现任何供应商与模型信息。自定义 AI 入口默认隐藏（`VITE_ALLOW_CUSTOM_AI` 控制），站长未配置模型服务时 AI 入口优雅降级为不可用，应用其余功能不受影响。

1. 在 Supabase 新建项目，在 SQL Editor 依次运行 `supabase/migrations/202609230001_beta_access.sql` 和 `supabase/migrations/202609250001_app_config.sql`。
2. 在 Supabase Auth 启用邮箱和密码注册，并保持邮箱验证开启。配置自有 SMTP，再把 Vercel 域名加入 Site URL 和 Redirect URLs。Supabase 默认邮件服务不能给非项目成员发送登录邮件。
3. 在 Vercel 连接仓库并配置环境变量：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`VITE_REQUIRE_INVITE=true`、`VITE_DEFAULT_AI_ENABLED=true`、`VITE_ALLOW_CUSTOM_AI=false`、`ADMIN_EMAIL=站长邮箱`。Service Role Key 与 `ADMIN_EMAIL` 只设为 Vercel 服务端变量；不要使用 `VITE_` 前缀。
4. 配置统一 LLM 与邀请码，两种方式任选：
   - **站长 GUI（推荐）**：用与 `ADMIN_EMAIL` 一致的邮箱注册账号并兑换邀请码后，进入「我的 → AI 解读」页的「站长配置」卡片，表单填写模型服务地址、API Key、两档模型名与月预算，保存即生效（最迟 60 秒，无需重新部署）；邀请码也在同一卡片生成，只显示一次。API Key 更换时才填写，留空保持不变。
   - **本地命令行**：在本地管理员环境设置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 后，`npm run ai:config -- --base-url=… --api-key=… --model-standard=… --model-deep=… --budget=100` 配置统一 LLM（`npm run ai:config` 不带参数查看，Key 脱敏）；`npm run invite:create` 生成 14 天内有效的一次性邀请码（`--days=7` 改有效期）。
5. 部署后先用一个邀请码验证注册、兑换、AI 调用、深度额度和月预算，再发放其余邀请码。

部署前需要配置真实 Supabase 项目、SMTP 和模型服务 Key；仓库不包含这些秘密。当前 GitHub Pages 仍是公开的纯静态旧站，Vercel 邀请门禁不会自动关闭它。正式切换为邀请制后，应在 Vercel 验收完成时关闭旧 GitHub Pages 发布入口。

邀请门禁用于控制应用入口和服务端 AI 使用资格。PWA 的静态 HTML、JavaScript 与素材仍是公开可下载资源，不承载秘密或他人云端数据；若未来需要隐藏整个应用内容，应改为服务端渲染或增加真正的边缘身份验证层。

## 素材与内容版权

- 「经典韦特」牌面为 Pamela Colman Smith 绘制的韦特塔罗（Rider–Waite–Smith，1909 年初版），已进入公有领域，扫描件来自 Wikimedia Commons
- 「致敬夜之城」「绚烂霓虹」为 AI 生成的画风致敬二创（gpt-image-2 + 程序化构图），与任何游戏原画无像素级复刻关系
- 中文牌意与课程内容以 A.E. Waite《The Pictorial Key to the Tarot》（公有领域）为底本自行撰写
- 本项目定位为塔罗文化学习与自我探索工具，不提供任何医疗、法律或财务建议
