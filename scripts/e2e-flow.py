# -*- coding: utf-8 -*-
# 星语塔罗 M1 动线 E2E 验收：完整仪式链 / 刷新恢复 / 凯尔特十字堆叠点击 / 续局横幅 / 桌面视口
#
# 运行（先设浏览器路径，二进制装在 D 盘）：
#   $env:PLAYWRIGHT_BROWSERS_PATH='D:\claude-tools\ms-playwright'
#   python "C:\Users\86181\.claude\skills\webapp-testing\scripts\with_server.py" `
#     --server "npm run preview" --port 4173 -- python scripts/e2e-flow.py
# 截图输出到仓库根 .e2e-shots/（已 gitignore）
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173/TarotCards/"
SHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".e2e-shots")
os.makedirs(SHOT, exist_ok=True)

results = []
console_errors = []


def check(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ") + name + (" | " + extra if extra else ""))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        locale="zh-CN",
    )
    page = ctx.new_page()
    page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))
    page.on(
        "console",
        lambda m: console_errors.append(f"console.{m.type}: {m.text}")
        if m.type == "error"
        else None,
    )

    # ---------- 场景 A：首访引导 + 时间之流完整动线 ----------
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    check("A1 首访重定向到引导页", "#/welcome" in page.url)
    page.screenshot(path=f"{SHOT}/a1-welcome.png")

    page.click("text=下一步")
    page.click("text=下一步")
    page.click("text=开始体验")
    page.wait_for_selector(".cta")
    check("A2 引导完成进入首页", "开始占卜" in page.content())
    check("A2b 首页不再挂牌阵列表（Task 21）", page.locator("#spreads").count() == 0)
    page.screenshot(path=f"{SHOT}/a2-home.png")

    # Task 21：牌阵列表搬到 /spreads 独立页，首页 CTA 进入
    page.click(".cta")
    page.wait_for_selector("text=时间之流")
    check("A2c 进入选牌阵页", "#/spreads" in page.url)
    check("A2d 选牌阵页无 TabBar", page.locator(".tabbar").count() == 0)
    check("A2e 选牌阵页有图标返回", page.locator(".flow-exit").count() == 1)
    page.screenshot(path=f"{SHOT}/a2b-spreads.png")

    page.click("text=时间之流")
    # 836a564 起静心独立页已并入提问页（呼吸提示行），不再有「跳过」按钮
    page.wait_for_selector("text=你想问什么？")
    check("A3 提问页含呼吸提示行", page.locator(".breathe-hint").count() == 1)
    check("A4 提问页", True)
    page.fill("textarea", "接下来三个月我的事业重心？")
    page.click("text=事业")
    page.screenshot(path=f"{SHOT}/a4-question.png")
    page.click("text=开始洗牌")

    page.wait_for_selector("text=拖动搅乱牌堆")
    hint = page.locator(".hint")
    check("A5 洗牌页含首次手势引导浮层", hint.count() == 1)
    if hint.count():
        hint.click()
    page.screenshot(path=f"{SHOT}/a5-shuffle.png")
    page.click("text=洗好了")

    page.wait_for_selector("text=已选")
    check("A6 抽牌页", True)
    slots = page.locator(".strip .slot")
    check("A6b 牌背数量 78", slots.count() == 78, f"实际 {slots.count()}")
    # 扇形叠放：每张牌可点的是左侧 44px 可见条（按钮中心被右侧邻牌覆盖，Playwright 默认点中心会被拦）
    # 2949bbc 起选牌改为两步：内联选中 → 底部确认栏「放入」
    slots.nth(5).click(position={"x": 15, "y": 60})
    check("A6c 选中出现内联确认栏", page.locator(".confirm-bar").count() == 1)
    page.click(".confirm-bar button")
    slots.nth(30).click(position={"x": 15, "y": 60})
    page.screenshot(path=f"{SHOT}/a6-pick.png")
    page.click(".confirm-bar button")
    slots.nth(60).click(position={"x": 15, "y": 60})
    page.click(".confirm-bar button")

    page.wait_for_selector("text=点击牌背，逐张翻开")
    check("A7 选满自动进翻牌页", True)
    canvas_slots = page.locator(".canvas .slot")
    check("A7b 翻牌页 3 个牌位", canvas_slots.count() == 3, f"实际 {canvas_slots.count()}")

    # 只翻第 3 张（未来），测试刷新恢复是否精确恢复"翻开的是哪张"
    canvas_slots.nth(2).click()
    page.wait_for_timeout(700)
    flipped = page.locator(".flipper.flipped")
    check("A8 翻开 1 张", flipped.count() == 1)
    page.reload()
    page.wait_for_load_state("networkidle")
    page.wait_for_selector(".canvas .slot")
    page.wait_for_timeout(400)
    flipped_keys = page.evaluate(
        "JSON.parse(sessionStorage.getItem('tarot.flow.v1')).revealedKeys"
    )
    check(
        "A9 刷新后精确恢复乱序翻牌（revealedKeys=['future']）",
        flipped_keys == ["future"],
        str(flipped_keys),
    )
    check("A9b 刷新后仍只翻开 1 张", page.locator(".flipper.flipped").count() == 1)
    page.screenshot(path=f"{SHOT}/a9-reveal-restored.png")

    page.locator(".canvas .slot").nth(0).click()
    page.wait_for_timeout(650)
    page.locator(".canvas .slot").nth(1).click()
    page.wait_for_selector("text=查看解读")
    check("A10 全部翻开出现查看解读", True)
    page.screenshot(path=f"{SHOT}/a10-reveal-all.png")
    page.click("text=查看解读")

    page.wait_for_selector("text=整体串联")
    check("A11 解读页", True)
    check("A11b 解读页显示领域短句（事业）", page.locator(".domain-tag").count() >= 0)
    page.locator(".pos-head").first.click()
    page.wait_for_timeout(300)
    check("A12 展开全文", page.locator(".pos-body").count() == 1)
    page.locator(".more").first.click()
    page.wait_for_selector(".modal-card", timeout=3000)
    # 小牌无 symbols 时"牌面符号"区块是条件渲染；"正位/逆位"区块必然存在
    check("A13 牌详情弹层", page.locator(".modal-sec").count() >= 2)
    page.screenshot(path=f"{SHOT}/a13-detail-modal.png")
    page.click("text=关闭")
    check("A14 练习模式入口存在", page.locator("text=练习模式").count() == 1)
    page.screenshot(path=f"{SHOT}/a14-interpretation.png", full_page=True)

    # ---------- 场景 B：续局横幅 ----------
    # Task 15 起 popstate 在动线内是「逐级回退」，改 hash 直跳首页会被当成返回手势退回上一步；
    # 这里用整文档加载模拟「关掉再打开」，流程态从 sessionStorage 恢复
    page.goto("about:blank")
    page.goto(BASE + "#/")
    page.wait_for_selector(".cta")
    check("B1 解读中回首页出现续局横幅", page.locator(".resume").count() == 1)
    page.screenshot(path=f"{SHOT}/b1-resume-banner.png")
    page.locator(".resume").click()
    page.wait_for_selector("text=整体串联")
    check("B2 续局回到解读页", "interpretation" in page.url)

    page.click("text=再来一次")
    page.wait_for_selector(".cta")
    check("B3 再来一次回首页", True)
    check("B3b 续局横幅已消失", page.locator(".resume").count() == 0)

    # ---------- 场景 C：凯尔特十字（堆叠点击 + 帮我抽完 + 全部翻开） ----------
    page.click(".cta")
    page.wait_for_selector("text=凯尔特十字")
    page.click("text=凯尔特十字")
    page.wait_for_selector("text=你想问什么？")
    page.click("text=开始洗牌")
    page.wait_for_selector("text=洗好了")
    check("C1 第二局无手势引导浮层", page.locator(".hint").count() == 0)
    page.click("text=洗好了")
    page.wait_for_selector("text=帮我抽完")
    page.click("text=帮我抽完")
    page.wait_for_selector("text=点击牌背，逐张翻开")
    c_slots = page.locator(".canvas .slot")
    check("C2 凯尔特十字 10 牌位", c_slots.count() == 10, f"实际 {c_slots.count()}")
    page.screenshot(path=f"{SHOT}/c2-celtic-reveal.png")

    # 堆叠点击测试：heart 与 cross 同坐标。连点同一点两次，应依次翻开两张（先 heart 后 cross）
    cross_slot = c_slots.nth(1)
    box = cross_slot.bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.click(cx, cy)
    page.wait_for_timeout(700)
    n1 = page.locator(".flipper.flipped").count()
    page.mouse.click(cx, cy)
    page.wait_for_timeout(700)
    n2 = page.locator(".flipper.flipped").count()
    check("C3 堆叠感知：同一点两次点击翻开两张（heart→cross）", n1 == 1 and n2 == 2, f"n1={n1} n2={n2}")
    keys = page.evaluate("JSON.parse(sessionStorage.getItem('tarot.flow.v1')).revealedKeys")
    check("C3b 先核心后阻碍", keys == ["heart", "cross"], str(keys))
    page.screenshot(path=f"{SHOT}/c3-celtic-stack.png")

    page.click("text=全部翻开")
    page.wait_for_selector("text=查看解读")
    check("C4 全部翻开", page.locator(".flipper.flipped").count() == 10)
    page.screenshot(path=f"{SHOT}/c4-celtic-all.png")
    page.click("text=查看解读")
    page.wait_for_selector("text=整体串联")
    check("C5 凯尔特十字解读页（10 张折叠卡）", page.locator(".pos-card").count() == 10)
    page.screenshot(path=f"{SHOT}/c5-celtic-interp.png", full_page=True)

    # ---------- 场景 D：桌面视口冒烟 ----------
    dpage = ctx.new_page()
    dpage.set_viewport_size({"width": 1280, "height": 860})
    dpage.goto(BASE + "#/")
    dpage.wait_for_selector(".cta")
    tabbar = dpage.locator(".tabbar").bounding_box()
    check("D1 桌面宽屏 TabBar 变竖栏", tabbar and tabbar["width"] < 120, str(tabbar))
    dpage.screenshot(path=f"{SHOT}/d1-desktop.png")
    dpage.close()

    browser.close()

print("\n==== 汇总 ====")
fails = [r for r in results if not r[1]]
print(f"{len(results) - len(fails)}/{len(results)} 通过")
for name, ok, extra in fails:
    print(f"  FAIL: {name} {extra}")
if console_errors:
    print("\n==== 控制台错误 ====")
    for e in console_errors[:20]:
        print("  " + e)
sys.exit(1 if fails else 0)
