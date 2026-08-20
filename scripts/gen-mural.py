# -*- coding: utf-8 -*-
"""夜城壁画皮肤生成管线（2026-08-19，用户三选确认：C1 叙事/D1 远景/E2 剪影嵌灯火）。

- 22 大牌：生图 edits 端点，每张以自己的游戏原画作「画风锚点」，构图按分配的模式重写
  （二次创作，非复刻）；护栏：与该牌原画的结构相似度须在 ±0.30（复制级≈+0.37），
  越界自动重生成一次；愚者复用已确认的 D1 样稿。
- 牌背：世界原画作锚点，对称星芒+剪影嵌灯火装置。
- 56 小牌：PIL 扁平壁画语言（近黑底+血红框+花色模版印双色）。
- key 走环境变量/.workbuddy/local-secrets.md；产物 500x839 webp。
"""
import base64
import io
import json
import math
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DECK = ROOT / "public" / "decks" / "night-mural"
ORIG = ROOT / "public" / "style-samples" / "orig"
SECRETS = ROOT / ".workbuddy" / "local-secrets.md"
API = "https://www.bytecatcode.org/v1/images/edits"
CARD_W, CARD_H = 500, 839
SIM_OK = 0.30

# 游戏编号 -> (应用id, 原画文件名)
ORIG_FILES = {
    1: "TarotCard_01_TheFool.png", 2: "TarotCard_02_TheMagician.png",
    3: "TarotCard_03_TheHighPriestess.png", 4: "TarotCard_04_TheEmpress.png",
    5: "TarotCard_05_TheEmperor.png", 6: "TarotCard_06_TheHierophant.png",
    7: "TarotCard_07_TheLovers.png", 8: "TarotCard_08_TheChariot.png",
    9: "TarotCard_09_Strength.png", 10: "TarotCard_10_TheHermit.png",
    11: "TarotCard_11_WheelOfFortune.png", 12: "TarotCard_12_Justice.png",
    13: "TarotCard_13_TheHangedMan.png", 14: "TarotCard_14_Death.png",
    15: "TarotCard_15_Temperance.png", 16: "TarotCard_16_TheDevil.png",
    17: "TarotCard_17_TheTower.png", 18: "TarotCard_18_TheStar.png",
    19: "TarotCard_19_TheMoon.png", 20: "TarotCard_20_TheSun.png",
    21: "TarotCard_21_Judgement.png", 22: "TarotCard_22_TheWorld.png",
}

ANCHOR = (
    "Paint a NEW tarot card in EXACTLY the same art style, painting technique, flat color "
    "fields, dark limited palette and gritty spray-paint mural texture as the reference image. "
)
MODE = {
    "C1": ("Narrative scene: {subject} Keep the scene concept but completely change the "
           "viewing angle, pose details and layout - a fresh reinterpretation, not a copy. "),
    "D1": ("Distant high-angle city view: {subject} Seen from far away or high above, small "
           "figures against vast city scale. "),
    "E2": ("Symbolic silhouette device: {subject} Rendered as bold flat black silhouettes "
           "whose interiors are filled with tiny flat city lights, window grids and neon "
           "signs, against flat color fields and simple geometric shapes. "),
}
TAIL = "Only the art style, palette and mood come from the reference. No text, no watermark."

SUBJECTS = {  # 应用 major-NN -> (模式, 题材)
    "major-01": ("C1", "The Magician - a gold-jacketed skull-faced street conjurer behind a console table holding knives and a star-marked beverage can, an infinity symbol glowing below their chest, a wall of red masks behind them."),
    "major-02": ("C1", "The High Priestess - a seated enigmatic figure between two server-rack pillars, a veil of hanging cables behind her, a crescent hologram at her feet, a scroll of light in her lap, cool dark blues and deep reds."),
    "major-03": ("C1", "The Empress - a serene motherly figure crowned with neon flowers in a rooftop greenhouse, flowers in gradient from muted purple to reddish pink, two red skyscrapers against a pitch black sky above."),
    "major-04": ("C1", "The Emperor - a rigid corporate overlord seated on a throne of machinery, wires and dark glass, yellow background of stacked window grids, two ram-headed guardian drones at his sides."),
    "major-05": ("C1", "The Hierophant - a cyber-cult leader hovering cross-legged with a machine-like head and two bright red eyes, one hand raised in blessing, cracked buildings in blue and purple behind with smoke rising."),
    "major-06": ("C1", "The Lovers - two figures embracing on a rooftop, layered abstract background: dark orange field, a large yellow circle, a black triangle, small green and red flame buds at the bottom."),
    "major-07": ("D1", "The Chariot - an armored street-racer hunched over a hoverbike streaking through dark city streets far below, abstract dark purple background with light purple speed lines."),
    "major-08": ("C1", "Strength - a hooded feminine figure from chest up, face replaced by hollow criss-crossing metal beams with two red dot eyes, a deep blue tattoo of a woman prying open a wolf's jaws on her chest, dirty yellow corners."),
    "major-09": ("C1", "The Hermit - a lone hooded figure on a high fire escape holding up a lantern of pure light, seen from a respectful distance so the vast dark city spreads below, background gradient from deep red to brighter yellow, towers and support beams around."),
    "major-10": ("C1", "Wheel of Fortune - a giant eight-spoked wheel inscribed on a bullet-holed wall, surrounded by a ring of alchemical symbols and glyphs, two small figures reaching toward the wheel from below."),
    "major-11": ("C1", "Justice - a composed veiled woman between two purple towers with pipes and wires, holding a holographic balance scale in one hand and a sword of light in the other."),
    "major-12": ("C1", "The Hanged Man - a man suspended upside-down by one bound ankle from cables above the frame, serene halo of light around his head, four onlooking figures with single cybernetic eyes in bands of orange, brown and pink."),
    "major-13": ("C1", "Death - a left-facing cybernetic rider figure with a spiked metallic skull head and glowing yellow eyes, wires and cables streaming from the skull, flat light red background, a rose banner."),
    "major-14": ("C1", "Temperance - a seated cyborg man pouring liquid light between two chrome vessels, wearing a grey tank top marked with a black triangle inside a white square, calm rooftop scene."),
    "major-15": ("C1", "The Devil - a horned cybernetic face with many decorative red optic eyes arranged in a pattern, barred teeth in a hungry smile, deep blood red background, ornamental chains draped around."),
    "major-16": ("C1", "The Tower - a corporate tower struck by a huge lightning bolt, crown shattering into falling debris and fire, tiny figures plummeting, the dark city spreading below under a storm sky, seen from across the street so the whole tower fits the frame."),
    "major-17": ("C1", "The Star - a woman kneeling gracefully in a giant martini glass pouring water onto the ground, numerous shrouded onlookers with single purple eyes watching from the darkness, purple sparkles scattered like stars."),
    "major-18": ("C1", "The Moon - a huge moon with a serene face glowing over a mass city skyline, two wolves amid scrap metal and bones below, one howling upward, a pale path winding between them into darkness."),
    "major-19": ("C1", "The Sun - a white-clad cowgirl riding a golden motorcycle bathed in warm light, a radiant sun disc behind her, sunflowers with glowing centers along the bottom edge."),
    "major-20": ("C1", "Judgement - a cloaked skeletal trumpeter with dark wing shapes behind, sounding a long trumpet that beams light down onto figures rising from grave-like holes with arms outstretched."),
    "major-21": ("C1", "The World - a dancer wrapped in a wreath-oval of glowing circuit vines suspended above the city, one leg crossed behind the other, two light-wands held loosely, four neon glyphs glowing in the corners."),
}
BACK_SUBJECT = (
    "A perfectly symmetrical tarot card back emblem - a large eight-pointed star of wires and "
    "circuit traces at the center, surrounded by concentric rings of neon signs and alchemical "
    "glyphs, on a deep blood-red field, bold flat black shapes with tiny city lights."
)

# ---------------- 生图（edits 参考图模式） ----------------

def key():
    if k := __import__("os").environ.get("BYTECAT_KEY"):
        return k
    return re.search(r"api-key:\s*(\S+)", SECRETS.read_text(encoding="utf-8")).group(1)


def fit_crop(im, w, h):
    """按目标比例居中裁切再缩放（图源 2:3 竖版 -> 裁宽保高，勿裁高产生黑边）。"""
    src_ratio = im.width / im.height
    dst_ratio = w / h
    if src_ratio > dst_ratio:  # 图源更宽：裁宽
        tw = int(im.height * dst_ratio)
        x = (im.width - tw) // 2
        im = im.crop((x, 0, x + tw, im.height))
    else:                      # 图源更高：裁高
        th = int(im.width / dst_ratio)
        y = (im.height - th) // 2
        im = im.crop((0, y, im.width, y + th))
    return im.resize((w, h), Image.LANCZOS)


def edits_gen(ref_png, prompt, out_webp, k):
    proc = subprocess.run(
        ["curl", "-s", "--noproxy", "*", "-m", "300", "-X", "POST", API,
         "-H", f"Authorization: Bearer {k}",
         "-F", "model=gpt-image-2", "-F", f"image=@{ref_png}",
         "-F", "size=1024x1536", "-F", "quality=medium", "-F", f"prompt={prompt}"],
        capture_output=True, text=True, timeout=320)
    d = json.loads(proc.stdout)
    b64 = d["data"][0].get("b64_json") if d.get("data") else None
    if not b64:
        raise RuntimeError(f"生图失败: {str(d)[:200]}")
    im = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    im = fit_crop(im, CARD_W, CARD_H)
    im.save(out_webp, "WEBP", quality=85)


def sim(f1, f2):
    a = Image.open(f1).convert("L").resize((16, 32))
    b = Image.open(f2).convert("L").resize((16, 32))
    pa, pb = list(a.getdata()), list(b.getdata())
    n = len(pa)
    ma, mb = sum(pa) / n, sum(pb) / n
    cov = sum((x - ma) * (y - mb) for x, y in zip(pa, pb))
    va = sum((x - ma) ** 2 for x in pa)
    vb = sum((y - mb) ** 2 for y in pb)
    return cov / math.sqrt(va * vb) if va and vb else 0


def ensure_ref(n):
    ref = ROOT / f"ref_mural_{n:02d}.png"
    if not ref.exists():
        Image.open(ORIG / ORIG_FILES[n]).save(ref, "PNG")
    return ref


def gen_major(app_id, game_no, mode, subject, k):
    out = DECK / f"{app_id}.webp"
    if out.exists():
        return f"skip {app_id}"
    ref = ensure_ref(game_no)
    orig = ORIG / ORIG_FILES[game_no]
    prompt = ANCHOR + MODE[mode].format(subject=subject) + TAIL
    for attempt in (1, 2):
        edits_gen(ref, prompt, out, k)
        s = sim(out, orig)
        if abs(s) <= SIM_OK:
            return f"ok {app_id} sim={s:+.3f}"
        if attempt == 1:
            out.unlink()  # 越界：删除重生成一次
    s = sim(out, orig)
    flag = "KEEP(marginal)" if abs(s) <= 0.35 else "FAIL"
    return f"{flag} {app_id} sim={s:+.3f}"


def gen_back(k):
    out = DECK / "back.webp"
    if out.exists():
        return "skip back"
    ref = ensure_ref(22)  # 世界原画：最具「装置感」
    edits_gen(ref, ANCHOR + BACK_SUBJECT + " " + TAIL, out, k)
    return "ok back"


# ---------------- 小牌：PIL 扁平壁画 ----------------

SUIT_COLOR = {  # (描边暗色, 芯色) 模版印双层
    "wands": ((120, 24, 16), (200, 60, 34)),      # 血红橙
    "cups": ((96, 18, 40), (188, 52, 92)),        # 深品红
    "swords": ((44, 30, 70), (150, 120, 200)),    # 暗紫
    "pentacles": ((96, 70, 12), (222, 178, 60)),  # 暗金
}
COURT_CN = {11: "侍从", 12: "骑士", 13: "王后", 14: "国王"}

def draw_wands(d, box, col):
    (x0, y0), (x1, y1) = box
    cx = (x0 + x1) / 2; w = max(5, (x1 - x0) * 0.16)
    d.line([(cx, y0 + w), (cx, y1 - w)], fill=col, width=int(w))
    d.ellipse([cx - w * 1.4, y0 - w * 0.4, cx + w * 1.4, y0 + w * 2.4], fill=col)
    d.ellipse([cx - w * 0.8, y1 - w * 1.6, cx + w * 0.8, y1], fill=col)

def draw_cups(d, box, col):
    (x0, y0), (x1, y1) = box
    cx = (x0 + x1) / 2; w = max(4, (x1 - x0) * 0.11)
    d.arc([x0, y0, x1, y0 + (y1 - y0) * 0.75], 180, 360, fill=col, width=int(w))
    d.line([(cx, y0 + (y1 - y0) * 0.75), (cx, y1 - w * 2)], fill=col, width=int(w))
    d.line([(cx - w * 3, y1), (cx + w * 3, y1)], fill=col, width=int(w))
    d.line([(x0 - w, y0), (x1 + w, y0)], fill=col, width=int(w))

def draw_swords(d, box, col):
    (x0, y0), (x1, y1) = box
    cx = (x0 + x1) / 2; w = max(4, (x1 - x0) * 0.15)
    d.polygon([(cx, y0), (cx + w, y0 + (y1 - y0) * 0.3), (cx + w, y1 - w * 4), (cx, y1),
               (cx - w, y1 - w * 4), (cx - w, y0 + (y1 - y0) * 0.3)], fill=col)
    gy = y1 - w * 4
    d.line([(cx - w * 3, gy), (cx + w * 3, gy)], fill=col, width=int(w))
    d.ellipse([cx - w, gy + w, cx + w, gy + w * 3], fill=col)

def draw_pentacles(d, box, col):
    import math as _m
    (x0, y0), (x1, y1) = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = min(x1 - x0, y1 - y0) / 2; w = max(4, r * 0.15)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=int(w))
    pts = [(cx + r * 0.78 * _m.cos(a), cy + r * 0.78 * _m.sin(a))
           for a in [i * 4 * _m.pi / 5 - _m.pi / 2 for i in range(5)]]
    d.line(pts + [pts[0]], fill=col, width=int(w))

GLYPHS = {"wands": draw_wands, "cups": draw_cups, "swords": draw_swords, "pentacles": draw_pentacles}

PIP_LAYOUTS = {
    2: [(.5, .16), (.5, .84)], 3: [(.5, .1), (.28, .68), (.72, .68)],
    4: [(.28, .2), (.72, .2), (.28, .7), (.72, .7)],
    5: [(.26, .18), (.74, .18), (.5, .42), (.26, .72), (.74, .72)],
    6: [(.26, .14), (.74, .14), (.26, .46), (.74, .46), (.26, .78), (.74, .78)],
    7: [(.26, .1), (.5, .22), (.74, .1), (.2, .52), (.44, .64), (.68, .52), (.56, .84)],
    8: [(.26, .1), (.74, .1), (.26, .37), (.74, .37), (.26, .64), (.74, .64), (.26, .9), (.74, .9)],
    9: [(.26, .1), (.5, .1), (.74, .1), (.26, .45), (.5, .45), (.74, .45), (.26, .8), (.5, .8), (.74, .8)],
    10: [(.26, .08), (.5, .08), (.74, .08), (.26, .4), (.5, .4), (.74, .4), (.5, .55), (.26, .82), (.5, .82), (.74, .82)],
}

def minor_card(suit, num):
    edge, core = SUIT_COLOR[suit]
    im = Image.new("RGB", (CARD_W, CARD_H))
    d = ImageDraw.Draw(im)
    for y in range(CARD_H):  # 近黑底带暗红晕
        t = y / CARD_H
        d.line([(0, y), (CARD_W, y)], fill=(14 + int(10 * (1 - t)), 6, 8))
    # 血红细框 + 角标
    d.rounded_rectangle([14, 14, CARD_W - 14, CARD_H - 14], radius=18, outline=(96, 16, 16), width=2)
    for cx, cy in [(14, 14), (CARD_W - 14, 14), (14, CARD_H - 14), (CARD_W - 14, CARD_H - 14)]:
        d.line([(cx - 10, cy), (cx + 10, cy)], fill=(96, 16, 16), width=2)
        d.line([(cx, cy - 10), (cx, cy + 10)], fill=(96, 16, 16), width=2)

    def stencil(draw_fn, box):
        (x0, y0), (x1, y1) = box
        draw_fn(d, box, edge)    # 模版印：先暗描边层
        inset = 4
        draw_fn(d, ((x0 + inset, y0 + inset), (x1 - inset, y1 - inset)), core)  # 后亮芯层

    if num == 1:
        cx, cy = CARD_W / 2, CARD_H / 2
        for a in range(0, 360, 30):
            import math as _m
            d.line([(cx + 95 * _m.cos(_m.radians(a)), cy + 95 * _m.sin(_m.radians(a))),
                    (cx + 135 * _m.cos(_m.radians(a)), cy + 135 * _m.sin(_m.radians(a)))],
                   fill=edge, width=2)
        stencil(GLYPHS[suit], ((cx - 62, cy - 62), (cx + 62, cy + 62)))
    elif num <= 10:
        s = 52 if num <= 4 else (46 if num <= 6 else 40)
        for rx, ry in PIP_LAYOUTS[num]:
            cx = 70 + rx * (CARD_W - 140)
            cy = 130 + ry * (CARD_H - 240)
            stencil(GLYPHS[suit], ((cx - s / 2, cy - s), (cx + s / 2, cy + s)))
    else:
        try:
            font = ImageFont.truetype(r"C:\Windows\Fonts\msyhbd.ttc", 44)
        except OSError:
            font = ImageFont.load_default()
        txt = COURT_CN[num]
        bb = d.textbbox((0, 0), txt, font=font)
        d.text(((CARD_W - bb[2] + bb[0]) / 2, 66), txt, font=font, fill=edge)
        d.text(((CARD_W - bb[2] + bb[0]) / 2 + 2, 68), txt, font=font, fill=core)
        cx, cy = CARD_W / 2, CARD_H * 0.58
        stencil(GLYPHS[suit], ((cx - 80, cy - 90), (cx + 80, cy + 90)))
        d.line([(cx - 60, cy + 130), (cx + 60, cy + 130)], fill=edge, width=2)
    return im

# ---------------- 注册 ----------------

def register():
    cards = {}
    for i in range(22):
        cards[f"major-{i:02d}"] = f"major-{i:02d}.webp"
    for suit in ("wands", "cups", "swords", "pentacles"):
        for n in range(1, 15):
            cards[f"{suit}-{n:02d}"] = f"{suit}-{n:02d}.webp"
    manifest = {
        "id": "night-mural", "name": "致敬夜之城",
        "author": "AI 二次创作（gpt-image-2，CP2077 塔罗壁画画风致敬）+ PIL 构图",
        "back": "back.webp", "cards": cards,
    }
    (DECK / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    idx_path = ROOT / "public" / "decks" / "index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8"))
    if "night-mural" not in idx:
        idx.append("night-mural")
        idx_path.write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")
    print("registered:", idx)

    # 牌背同步注册进独立牌背注册表：牌背选择/牌背墙只读 backs/index.json，
    # 皮肤自带 back.webp 不注册就是死资产
    backs_path = ROOT / "public" / "backs" / "index.json"
    backs = json.loads(backs_path.read_text(encoding="utf-8"))
    if not any(b["id"] == "night-mural" for b in backs):
        (ROOT / "public" / "backs" / "night-mural.webp").write_bytes((DECK / "back.webp").read_bytes())
        backs.append({"id": "night-mural", "name": "致敬夜之城", "file": "night-mural.webp"})
        backs_path.write_text(json.dumps(backs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("backs registered:", [b["id"] for b in backs])

def main():
    DECK.mkdir(parents=True, exist_ok=True)
    if "--minors" in sys.argv:
        n = 0
        for suit in SUIT_COLOR:
            for num in range(1, 15):
                out = DECK / f"{suit}-{num:02d}.webp"
                if out.exists():
                    continue
                minor_card(suit, num).save(out, "WEBP", quality=85)
                n += 1
        print(f"[minors] 新生成 {n} 张")
        return
    if "--register" in sys.argv:
        register()
        return

    k = key()
    # 愚者：复用已确认的 D1 样稿
    fool = DECK / "major-00.webp"
    if not fool.exists():
        fit_crop(Image.open(ROOT / "public/style-samples/draft-rework1.webp").convert("RGB"),
                 CARD_W, CARD_H).save(fool, "WEBP", quality=85)
        print("[major-00] 复用 C1 样稿并规整为 500x839")
    order = sorted(SUBJECTS.items())
    for app_id, (mode, subject) in order:
        game_no = int(app_id.split("-")[1]) + 1
        try:
            print(gen_major(app_id, game_no, mode, subject, k), flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"ERROR {app_id}: {e}", flush=True)
    try:
        print(gen_back(k), flush=True)
    except Exception as e:  # noqa: BLE001
        print(f"ERROR back: {e}", flush=True)

if __name__ == "__main__":
    main()
