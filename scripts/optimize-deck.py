#!/usr/bin/env python3
"""一次性脚本：将 public/decks/rws/raw/*.jpg 压缩为宽 500px 的 webp（画质 82）。
输出命名：大牌 major-00..21.webp；小牌 wands|cups|swords|pentacles-01..14.webp
（源文件花色 Pents 输出为 pentacles）。全部成功后删除 raw 目录。
用法: python scripts/optimize-deck.py
"""
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "public/decks/rws/raw"
OUT = ROOT / "public/decks/rws"
WIDTH = 500
QUALITY = 82

SUIT_MAP = {"Wands": "wands", "Cups": "cups", "Swords": "swords", "Pents": "pentacles"}


def output_name(src: Path) -> str:
    stem = src.stem
    if stem.startswith("RWS_Tarot_"):
        # RWS_Tarot_00_Fool -> major-00
        return f"major-{stem.split('_')[2]}.webp"
    for suit_prefix, suit_out in SUIT_MAP.items():
        if stem.startswith(suit_prefix):
            num = stem[len(suit_prefix):]
            return f"{suit_out}-{num}.webp"
    raise ValueError(f"无法识别的文件名: {src.name}")


def main() -> int:
    raws = sorted(RAW.glob("*.jpg"))
    if len(raws) != 78:
        print(f"raw 中 jpg 数量不为 78（实际 {len(raws)}），先运行 download-deck.sh")
        return 1

    for src in raws:
        dst = OUT / output_name(src)
        with Image.open(src) as im:
            im = im.convert("RGB")
            ratio = WIDTH / im.width
            im = im.resize((WIDTH, round(im.height * ratio)), Image.LANCZOS)
            im.save(dst, "WEBP", quality=QUALITY)
        print(f"{src.name} -> {dst.name}")

    produced = list(OUT.glob("*.webp"))
    if len([p for p in produced if p.name != "back.webp"]) != 78:
        print("输出数量校验失败，保留 raw 目录")
        return 1

    shutil.rmtree(RAW)
    print("OK: 78 张 webp 输出完成，raw 已删除")
    return 0


if __name__ == "__main__":
    sys.exit(main())
