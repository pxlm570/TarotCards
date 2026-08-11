# -*- coding: utf-8 -*-
# 课程风格演示截图：跑起真实页面，输出到 .e2e-shots/demo/
import os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4175/TarotCards/"
SHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".e2e-shots", "demo")
os.makedirs(SHOT, exist_ok=True)

SEED = """
localStorage.setItem('tarot.visited.v1','1');
localStorage.setItem('tarot.settings.v1', JSON.stringify({theme:'light', haptics:true}));
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="zh-CN")
    page = ctx.new_page()
    page.add_init_script(SEED)
    page.on("console", lambda m: print("CONSOLE", m.type, m.text) if m.type == "error" else None)

    # 学习 Tab（章节列表）
    page.goto(BASE + "#/learn")
    page.wait_for_selector("text=章节")
    page.wait_for_timeout(600)
    page.screenshot(path=f"{SHOT}/1-learn.png")

    # 章节页
    page.goto(BASE + "#/learn/ch-01")
    page.wait_for_selector("text=塔罗的结构")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{SHOT}/2-chapter.png", full_page=True)

    # 图文课（正文风格）
    page.goto(BASE + "#/learn/ch-01/ch-01-l1")
    page.wait_for_selector("text=78 张牌，两大部分")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{SHOT}/3-article.png", full_page=True)

    # 牌库 Tab
    page.goto(BASE + "#/deck")
    page.wait_for_selector("text=牌库")
    page.wait_for_timeout(900)
    page.screenshot(path=f"{SHOT}/4-deck.png", full_page=True)

    # 桌面视口的学习 Tab
    dctx = browser.new_context(viewport={"width": 1280, "height": 860}, locale="zh-CN")
    dpage = dctx.new_page()
    dpage.add_init_script(SEED)
    dpage.goto(BASE + "#/learn")
    dpage.wait_for_selector("text=章节")
    dpage.wait_for_timeout(600)
    dpage.screenshot(path=f"{SHOT}/5-learn-desktop.png")
    dpage.close(); dctx.close()

    browser.close()
    print("DONE ->", SHOT)
