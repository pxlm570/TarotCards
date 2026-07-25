#!/usr/bin/env python3
"""生成牌背 back.webp（占位质量，M5 精修）。
500×860，深空蓝 #14162E 底 + 古铜金 #B8912F 菱形纹路。
用法: python scripts/gen-back.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/decks/rws/back.webp"

W, H = 500, 860
BG = (0x14, 0x16, 0x2E)
GOLD = (0xB8, 0x91, 0x2F)
STEP = 44  # 菱形网格间距


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)

    # 两组 45° 斜线交织成菱形网格
    for x in range(-H, W + H, STEP):
        d.line([(x, 0), (x + H, H)], fill=GOLD + (38,), width=1)
        d.line([(x, 0), (x - H, H)], fill=GOLD + (38,), width=1)

    img = Image.alpha_composite(img.convert("RGBA"), overlay)
    d = ImageDraw.Draw(img)

    # 外框 + 内框
    d.rectangle([14, 14, W - 15, H - 15], outline=GOLD, width=4)
    d.rectangle([26, 26, W - 27, H - 27], outline=GOLD, width=1)

    # 中央大菱形
    cx, cy, r = W // 2, H // 2, 120
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], outline=GOLD, width=3)
    r2 = 96
    d.polygon([(cx, cy - r2), (cx + r2, cy), (cx, cy + r2), (cx - r2, cy)], outline=GOLD, width=1)

    img.convert("RGB").save(OUT, "WEBP", quality=82)
    print(f"OK: {OUT}")


if __name__ == "__main__":
    main()
