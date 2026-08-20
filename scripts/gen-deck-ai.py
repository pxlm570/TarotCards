# -*- coding: utf-8 -*-
"""AI 皮肤包生成管线（v1.5 Task 9，方案 B）：
- 22 张大牌 + 牌背：gpt-image-2 生图（bytecatcode 代理，OpenAI 协议）
  * 赛博朋克壁画风（对标《赛博朋克 2077》夜之城塔罗壁画：霓虹描线、夜空基调）
  * 代理站有 Cloudflare 指纹拦截（Python urllib 直连 403/1010），走 curl 子进程
- 56 张小牌：PIL 程序化霓虹构图（花色霓虹图形 + RWS 传统点数排布）
- key 只从环境变量 BYTECAT_KEY 或本地 .workbuddy/local-secrets.md 读取，绝不入库
- 可断点续跑：目标 webp 已存在则跳过对应生成

用法：
  python scripts/gen-deck-ai.py            # 全量生成（大牌走 API，小牌走 PIL）
  python scripts/gen-deck-ai.py --minors   # 只生成小牌（不调 API，秒级）
  python scripts/gen-deck-ai.py --register # 只写 manifest + 注册 index.json
"""
import base64
import io
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DECK_ID = "neon-glow"
DECK_NAME = "绚烂霓虹"
DECK_DIR = ROOT / "public" / "decks" / DECK_ID
SECRETS = ROOT / ".workbuddy" / "local-secrets.md"
API_URL = "https://www.bytecatcode.org/v1/images/generations"
API_MODEL = "gpt-image-2"
IMG_SIZE = "1024x1536"   # API 竖版最大档，裁到 500x839
CARD_W, CARD_H = 500, 839  # 与 rws 对齐（CSS aspect-ratio 300/527）
BACK_W, BACK_H = 500, 878
WORKERS = 3

SUITS = ["wands", "cups", "swords", "pentacles"]
SUIT_COLOR = {
    "wands": (255, 45, 185),      # 霓虹品红：行动之火
    "cups": (0, 229, 255),        # 霓虹青：情感之水
    "swords": (150, 200, 255),    # 冰蓝：思维之刃
    "pentacles": (255, 210, 40),  # 霓虹金：物质之币
}
COURT_CN = {11: "侍从", 12: "骑士", 13: "王后", 14: "国王"}

# 大牌的赛博朋克重释（保留塔罗符号骨架，霓虹壁画化）
STYLE = (
    "Tarot card art in the style of Cyberpunk 2077 Night City tarot murals: "
    "neon line art with magenta and cyan glow on deep dark background, "
    "gritty holographic vibe, vertical composition, no text, no border, no watermark"
)
MAJOR_PROMPTS = {
    0: "The Fool: a lone young figure stepping blithely off a rooftop ledge into neon rain, small holographic cat at heel, glowing drone like a sun-disc overhead, endless Night City skyline far below",
    1: "The Magician: a street-tech conjurer behind a console of glowing circuitry, one hand raised channeling a holographic infinity symbol, on the desk lie a code-wand, a chrome chalice, a drone-blade and a glowing data-coin",
    2: "The High Priestess: an enigmatic woman seated between two pillars of server racks, a veil of hanging cables behind her, crescent hologram at her feet, a scroll of light in her lap",
    3: "The Empress: a serene motherly figure crowned with neon flowers in a rooftop greenhouse garden, city domes and glowing vines around her, a cushion of circuit-moss underfoot",
    4: "The Emperor: a rigid corporate overlord on a throne of angular neon steel, armor of dark glass, two ram-headed guardian drones at his sides, skyline of towers behind",
    5: "The Hierophant: a cyber-cult leader in a mitre of antennas raising one hand in blessing, circuit-tattooed robes, two kneeling initiates with neural implants receiving the sign",
    6: "The Lovers: two figures embracing on a rooftop before a neon city sunset, a thin cable of light connecting their temples, a huge guardian drone with spread wings hovering above",
    7: "The Chariot: an armored street-racer on a hovering bike charging forward, canopy of city lights streaking past, square jaw and determined stare, two opposing light-trails beneath",
    8: "Strength: a calm woman in a leather jacket gently closing the jaws of a huge robotic lion, glowing infinity symbol floating above her head, soft neon flowers around",
    9: "The Hermit: a hooded figure alone on a fire escape high above the neon city, holding up a lantern of pure white light, scanning the streets below in contemplation",
    10: "The Wheel of Fortune: a giant rotating gear-and-data wheel covered in glowing glyphs rising above the city, small figures ascending and falling around its rim, sphinx-drone atop",
    11: "Justice: a composed woman between two neon pillars holding a holographic balance scale in one hand and a sword of light in the other, veil over her eyes, crown of a single node",
    12: "The Hanged Man: a serene figure suspended upside-down from a bundle of glowing cables, one leg crossed, halo of neon light around the head, broken screens below",
    13: "Death: a skeletal rider in black chrome armor on a robotic horse, carrying a banner with a glowing rose, the old city sector crumbling behind, sunrise of a new city rising ahead",
    14: "Temperance: a hooded figure pouring liquid light between two chrome vessels, one foot in a shallow neon pool, an iridescent holographic triangle glowing on their chest",
    15: "The Devil: a horned cybernetic figure with drone-blade wings looming atop a black pedestal in dark neon light, two ornate glowing chains of neon links draped decoratively over the pedestal, ominous temptation vibe",
    16: "The Tower: a sleek corporate tower struck by a bolt of lightning, crown shattering into falling debris and neon fire, two figures plummeting from the blast",
    17: "The Star: a hopeful nude figure kneeling by a neon pool pouring water from two vessels, one onto the pool and one onto the ground, a huge holographic eight-pointed star and seven small stars above",
    18: "The Moon: a giant holographic moon with a serene face over a dark path between two distant towers, a wolf and a cyberg-dog howling at it, crayfish of light crawling from a pool",
    19: "The Sun: a joyful child riding a robotic white horse under an enormous radiant neon sun, a wall of sunflowers with LED centers behind, a crimson banner streaming",
    20: "Judgement: figures rising with arms outstretched from chrome pods and graves to answer a vast holographic trumpet call beaming down from a sky of light, a child held up in wonder",
    21: "The World: a dancer wrapped in a wreath-oval of glowing circuit-vines suspended in a void, one leg crossed behind, two light-wands held loosely, four neon glyphs glowing in the corners",
}
BACK_PROMPT = (
    "Tarot card back design, perfectly symmetrical vertical mandala: an eight-pointed "
    "star of neon circuit traces at the center, radiating concentric rings of glowing "
    "circuitry, magenta and cyan neon lines on deep dark navy, ornamental cyberpunk "
    "mural style, no text, no border, no watermark"
)


def load_api_key():
    key = os.environ.get("BYTECAT_KEY")
    if key:
        return key.strip()
    if SECRETS.exists():
        m = re.search(r"api-key:\s*(\S+)", SECRETS.read_text(encoding="utf-8"))
        if m:
            return m.group(1)
    sys.exit("缺生图 key：设环境变量 BYTECAT_KEY 或确认 .workbuddy/local-secrets.md 存在")


def api_generate(prompt, key):
    """单次生图（curl 子进程，规避 CF 对 Python 指纹的 1010 拦截）。"""
    payload = json.dumps({
        "model": API_MODEL, "prompt": f"{prompt}. {STYLE}", "size": IMG_SIZE, "quality": "medium",
    })
    proc = subprocess.run(
        ["curl", "-s", "--noproxy", "*", "-m", "300", "-X", "POST", API_URL,
         "-H", f"Authorization: Bearer {key}", "-H", "Content-Type: application/json",
         "-d", payload],
        capture_output=True, text=True, timeout=320,
    )
    data = json.loads(proc.stdout)
    b64 = data["data"][0].get("b64_json") if data.get("data") else None
    if not b64:
        raise RuntimeError(f"生图响应异常: {str(data)[:200]}")
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")


def crop_to(im, w, h):
    """按目标比例居中裁剪再缩放。"""
    tw = im.height * w / h
    if tw <= im.width:
        x = int((im.width - tw) / 2)
        im = im.crop((x, 0, x + int(tw), im.height))
    else:
        th = im.width * h / w
        y = int((im.height - th) / 2)
        im = im.crop((0, y, im.width, y + int(th)))
    return im.resize((w, h), Image.LANCZOS)


def gen_major(num, key):
    out = DECK_DIR / f"major-{num:02d}.webp"
    if out.exists():
        return f"skip {out.name}"
    last_err = None
    for _ in range(2):  # 重试一次
        try:
            im = crop_to(api_generate(MAJOR_PROMPTS[num], key), CARD_W, CARD_H)
            im.save(out, "WEBP", quality=80)
            return f"ok {out.name}"
        except Exception as e:  # noqa: BLE001 管线要全程可续跑
            last_err = e
    return f"FAIL {out.name}: {last_err}"


def gen_back(key):
    out = DECK_DIR / "back.webp"
    if out.exists():
        return "skip back"
    try:
        im = crop_to(api_generate(BACK_PROMPT, key), BACK_W, BACK_H)
        im.save(out, "WEBP", quality=80)
        return "ok back"
    except Exception as e:  # noqa: BLE001
        return f"FAIL back: {e}"


# ---------------- 小牌：PIL 霓虹构图 ----------------

def neon(base, draw_fn, color, blur, alpha=255):
    """在 base 上画一层发光图形：模糊层做光晕 + 清晰层做芯线。"""
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer), color + (alpha,))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(max(1, blur // 3))))
    base.alpha_composite(layer)


def glyph_wands(d, box, color):
    (x0, y0), (x1, y1) = box
    cx = (x0 + x1) / 2
    w = max(4, (x1 - x0) * 0.14)
    d.line([(cx, y0 + w), (cx, y1 - w)], fill=color, width=int(w))
    d.ellipse([cx - w * 1.4, y0 - w * 0.4, cx + w * 1.4, y0 + w * 2.4], fill=color)  # 火种
    d.ellipse([cx - w * 0.8, y1 - w * 1.6, cx + w * 0.8, y1], fill=color)


def glyph_cups(d, box, color):
    (x0, y0), (x1, y1) = box
    cx = (x0 + x1) / 2
    w = max(3, (x1 - x0) * 0.1)
    d.arc([x0, y0, x1, y0 + (y1 - y0) * 0.75], start=180, end=360, fill=color, width=int(w))  # 杯身
    d.line([(cx, y0 + (y1 - y0) * 0.75), (cx, y1 - w * 2)], fill=color, width=int(w))         # 杯脚
    d.line([(cx - w * 3, y1), (cx + w * 3, y1)], fill=color, width=int(w))                     # 底座
    d.line([(x0 - w, y0), (x1 + w, y0)], fill=color, width=int(w))                             # 杯沿


def glyph_swords(d, box, color):
    (x0, y0), (x1, y1) = box
    cx = (x0 + x1) / 2
    w = max(3, (x1 - x0) * 0.16)
    d.polygon([(cx, y0), (cx + w, y0 + (y1 - y0) * 0.3), (cx + w, y1 - w * 4), (cx, y1),
               (cx - w, y1 - w * 4), (cx - w, y0 + (y1 - y0) * 0.3)], fill=color)              # 剑刃
    gy = y1 - w * 4
    d.line([(cx - w * 3, gy), (cx + w * 3, gy)], fill=color, width=int(w))                     # 护手
    d.ellipse([cx - w, gy + w, cx + w, gy + w * 3], fill=color)                                # 柄头


def glyph_pentacles(d, box, color):
    (x0, y0), (x1, y1) = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = (min(x1 - x0, y1 - y0)) / 2
    w = max(3, r * 0.14)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=int(w))
    pts = [(cx + r * 0.78 * __import__("math").cos(a), cy + r * 0.78 * __import__("math").sin(a))
           for a in [i * 4 * __import__("math").pi / 5 - __import__("math").pi / 2 for i in range(5)]]
    d.line(pts + [pts[0]], fill=color, width=int(w))  # 内接五芒星


GLYPHS = {"wands": glyph_wands, "cups": glyph_cups, "swords": glyph_swords, "pentacles": glyph_pentacles}

# RWS 传统点数排布（相对牌面内容区的归一化坐标）
PIP_LAYOUTS = {
    2:  [(.5, .16), (.5, .84)],
    3:  [(.5, .1), (.28, .68), (.72, .68)],
    4:  [(.28, .2), (.72, .2), (.28, .7), (.72, .7)],
    5:  [(.26, .18), (.74, .18), (.5, .42), (.26, .72), (.74, .72)],
    6:  [(.26, .14), (.74, .14), (.26, .46), (.74, .46), (.26, .78), (.74, .78)],
    7:  [(.26, .1), (.5, .22), (.74, .1), (.2, .52), (.44, .64), (.68, .52), (.56, .84)],
    8:  [(.26, .1), (.74, .1), (.26, .37), (.74, .37), (.26, .64), (.74, .64), (.26, .9), (.74, .9)],
    9:  [(.26, .1), (.5, .1), (.74, .1), (.26, .45), (.5, .45), (.74, .45), (.26, .8), (.5, .8), (.74, .8)],
    10: [(.26, .08), (.5, .08), (.74, .08), (.26, .4), (.5, .4), (.74, .4), (.5, .55), (.26, .82), (.5, .82), (.74, .82)],
}


def minor_card(suit, num):
    """生成一张小牌：暗夜渐变底 + 花色霓虹图形（点数排布/宫廷大图形）。"""
    color = SUIT_COLOR[suit]
    im = Image.new("RGBA", (CARD_W, CARD_H))
    # 暗夜竖向渐变
    for y in range(CARD_H):
        t = y / CARD_H
        c = (int(10 + 8 * (1 - t)), int(14 + 10 * (1 - t)), int(26 + 18 * (1 - t)), 255)
        ImageDraw.Draw(im).line([(0, y), (CARD_W, y)], fill=c)

    def frame(d, col):
        d.rounded_rectangle([14, 14, CARD_W - 14, CARD_H - 14], radius=18, outline=col, width=2)
        for cx, cy in [(14, 14), (CARD_W - 14, 14), (14, CARD_H - 14), (CARD_W - 14, CARD_H - 14)]:
            d.line([(cx - 10, cy), (cx + 10, cy)], fill=col, width=2)
            d.line([(cx, cy - 10), (cx, cy + 10)], fill=col, width=2)

    neon(im, frame, color, blur=6, alpha=110)

    content = (70, 130, CARD_W - 70, CARD_H - 110)  # x0,y0,x1,y1
    if num == 1:  # 王牌：单个大图形 + 放射线
        def ace(d, col):
            cx, cy = CARD_W / 2, CARD_H / 2
            for a in range(0, 360, 30):
                import math
                d.line([(cx + 95 * math.cos(math.radians(a)), cy + 95 * math.sin(math.radians(a))),
                        (cx + 135 * math.cos(math.radians(a)), cy + 135 * math.sin(math.radians(a)))],
                       fill=col, width=2)
            GLYPHS[suit](d, ((cx - 62, cy - 62), (cx + 62, cy + 62)), col)
        neon(im, ace, color, blur=10)
    elif num <= 10:
        def pips(d, col):
            s = 52 if num <= 4 else (46 if num <= 6 else 40)
            for rx, ry in PIP_LAYOUTS[num]:
                cx = content[0] + rx * (content[2] - content[0])
                cy = content[1] + ry * (content[3] - content[1])
                GLYPHS[suit](d, ((cx - s / 2, cy - s), (cx + s / 2, cy + s)), col)
        neon(im, pips, color, blur=7)
    else:  # 宫廷：汉字段位 + 大图形
        def court(d, col):
            font = court.font
            txt = COURT_CN[num]
            bb = d.textbbox((0, 0), txt, font=font)
            d.text(((CARD_W - bb[2] + bb[0]) / 2, 66), txt, font=font, fill=col)
            cx, cy = CARD_W / 2, CARD_H * 0.58
            GLYPHS[suit](d, ((cx - 80, cy - 90), (cx + 80, cy + 90)), col)
            d.line([(cx - 60, cy + 130), (cx + 60, cy + 130)], fill=col, width=2)
        try:
            court.font = ImageFont.truetype(r"C:\Windows\Fonts\msyhbd.ttc", 44)
        except OSError:
            court.font = ImageFont.load_default()
        neon(im, court, color, blur=9)
    return im.convert("RGB")


def gen_minors():
    n = 0
    for suit in SUITS:
        for num in range(1, 15):
            out = DECK_DIR / f"{suit}-{num:02d}.webp"
            if out.exists():
                continue
            minor_card(suit, num).save(out, "WEBP", quality=80)
            n += 1
    return n


def register():
    cards = {}
    for i in range(22):
        cards[f"major-{i:02d}"] = f"major-{i:02d}.webp"
    for suit in SUITS:
        for num in range(1, 15):
            cards[f"{suit}-{num:02d}"] = f"{suit}-{num:02d}.webp"
    manifest = {
        "id": DECK_ID, "name": DECK_NAME,
        "author": "AI 生成（gpt-image-2）+ 程序化霓虹构图",
        "back": "back.webp", "cards": cards,
    }
    DECK_DIR.mkdir(parents=True, exist_ok=True)
    (DECK_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    idx_path = ROOT / "public" / "decks" / "index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8"))
    if DECK_ID not in idx:
        idx.append(DECK_ID)
        idx_path.write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")
    print(f"manifest 写入（{len(cards)} 张），index.json = {idx}")

    # 牌背同步注册进独立牌背注册表：牌背选择/牌背墙只读 backs/index.json，
    # 皮肤自带 back.webp 不注册就是死资产
    backs_path = ROOT / "public" / "backs" / "index.json"
    backs = json.loads(backs_path.read_text(encoding="utf-8"))
    if not any(b["id"] == DECK_ID for b in backs):
        (ROOT / "public" / "backs" / f"{DECK_ID}.webp").write_bytes((DECK_DIR / "back.webp").read_bytes())
        backs.append({"id": DECK_ID, "name": DECK_NAME, "file": f"{DECK_ID}.webp"})
        backs_path.write_text(json.dumps(backs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("backs registered:", [b["id"] for b in backs])


def main():
    DECK_DIR.mkdir(parents=True, exist_ok=True)
    only_minors = "--minors" in sys.argv
    only_register = "--register" in sys.argv

    print(f"[minors] 新生成 {gen_minors()} 张小牌")
    if only_minors:
        return
    if not only_register:
        key = load_api_key()
        jobs = [(i, key) for i in range(22)]
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            for r in pool.map(lambda a: gen_major(*a), jobs):
                print(f"[major] {r}")
        print(f"[back] {gen_back(key)}")
    register()
    missing = [p.name for p in DECK_DIR.glob("*.webp")]
    print(f"[done] 目录共 {len(missing)} 个 webp")


if __name__ == "__main__":
    main()
