#!/usr/bin/env python3
"""生成 public/decks/rws/manifest.json 并校验：
- cards 映射恰好 78 条（major-00..21 + wands|cups|swords|pentacles-01..14）
- 每个映射文件存在且非空
用法: python scripts/gen-manifest.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DECK = ROOT / "public/decks/rws"

cards: dict[str, str] = {}
for i in range(22):
    cid = f"major-{i:02d}"
    cards[cid] = f"{cid}.webp"
for suit in ("wands", "cups", "swords", "pentacles"):
    for n in range(1, 15):
        cid = f"{suit}-{n:02d}"
        cards[cid] = f"{cid}.webp"

manifest = {
    "id": "rws",
    "name": "经典韦特（1909 原版）",
    "author": "Pamela Colman Smith（公有领域）",
    "back": "back.webp",
    "cards": cards,
}

out = DECK / "manifest.json"
out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

errors = []
if len(cards) != 78:
    errors.append(f"cards 条数 {len(cards)} != 78")
for cid, fname in cards.items():
    p = DECK / fname
    if not p.is_file() or p.stat().st_size == 0:
        errors.append(f"缺失或空文件: {fname}（{cid}）")
back = DECK / manifest["back"]
if not back.is_file() or back.stat().st_size == 0:
    errors.append("back.webp 缺失或为空")

if errors:
    print("\n".join(errors))
    sys.exit(1)
print(f"OK: manifest 78 条映射，78 张牌面 + 牌背全部存在且非空 -> {out}")
