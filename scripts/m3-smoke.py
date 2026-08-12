# -*- coding: utf-8 -*-
# M3 功能冒烟：每日一抽动线→落库→记录页→我的页本命牌。输出 .e2e-shots/m3/
import os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4175/TarotCards/"
SHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".e2e-shots", "m3")
os.makedirs(SHOT, exist_ok=True)

SEED = "localStorage.setItem('tarot.visited.v1','1');localStorage.setItem('tarot.settings.v1',JSON.stringify({theme:'light'}));"

errs = []
def run():
  with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width":390,"height":844}, is_mobile=True, locale="zh-CN")
    pg = ctx.new_page()
    pg.add_init_script(SEED)
    pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    pg.on("pageerror", lambda e: errs.append("PAGEERR "+str(e)))

    # 首页
    pg.goto(BASE+"#/", wait_until="networkidle")
    pg.wait_for_selector("text=每日一抽", timeout=20000)
    print("OK 首页（每日一抽 + XP + 小目标）")
    pg.screenshot(path=f"{SHOT}/1-home.png")

    # 每日一抽：跳过静心→提问→洗牌→帮我抽完→查看解读（触发落库+打卡）
    pg.click("text=每日一抽")
    pg.wait_for_selector("text=深呼吸，默念你的问题")
    pg.click("text=跳过")
    pg.wait_for_selector("text=你想问什么？")
    pg.click("text=开始洗牌")
    pg.wait_for_selector("text=洗好了")
    # 首次进入有手势引导浮层，点掉以免挡住按钮
    hint = pg.locator(".hint")
    if hint.count():
        hint.click()
        pg.wait_for_timeout(300)
    pg.click("text=洗好了")
    pg.wait_for_selector("text=帮我抽完")
    pg.click("text=帮我抽完")
    pg.wait_for_selector("text=全部翻开", timeout=20000)
    pg.click("text=全部翻开")
    pg.wait_for_selector("text=查看解读", timeout=20000)
    pg.click("text=查看解读")
    pg.wait_for_selector("text=整体串联", timeout=20000)
    print("OK 每日一抽完成并进入解读（应已落库+打卡）")

    # 校验 localStorage 落库与打卡
    saved = pg.evaluate("JSON.parse(localStorage.getItem('tarot.journal.v1'))")
    assert saved and len(saved["readings"])>=1, "未落库"
    assert saved["readings"][0]["isDaily"] is True, "daily 标记缺失"
    assert len(saved["dailyDraws"])>=1, "未打卡"
    print("OK 落库 + 每日打卡：", len(saved["readings"]), "条记录")

    # 记录页：应显示该记录
    pg.goto(BASE+"#/journal", wait_until="networkidle")
    pg.wait_for_selector("text=单张指引", timeout=20000)
    print("OK 记录页显示时间线")
    pg.screenshot(path=f"{SHOT}/2-journal.png")
    pg.click("text=镜子")
    pg.wait_for_timeout(600)
    print("OK 镜子 Tab 可切换")
    pg.screenshot(path=f"{SHOT}/3-mirror.png")

    # 我的页：设置生日 → 本命牌
    pg.goto(BASE+"#/profile", wait_until="networkidle")
    pg.wait_for_selector("text=算出我的本命牌", timeout=20000)
    pg.fill("input[type=date]", "1990-05-23")
    pg.click("text=算出我的本命牌")
    pg.wait_for_selector("text=11/2", timeout=20000)
    print("OK 本命牌 1990-05-23 → 11/2")
    pg.screenshot(path=f"{SHOT}/4-profile.png")

    b.close()
  return errs

e = run()
print("控制台错误:", e[:8] if e else "无")
sys.exit(1 if e else 0)
