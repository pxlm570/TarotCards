#!/usr/bin/env python3
"""生成 78 张塔罗牌桩数据（空模板），输出到 src/data/cards.json。

id 规则：
  - 大牌：major-00 ... major-21（0 愚人 ... 21 世界）
  - 小牌：<花色>-01 ... <花色>-14
      wands 权杖 / cups 圣杯 / swords 宝剑 / pentacles 星币
      01=Ace, 02-10=数字牌, 11=侍从 12=骑士 13=王后 14=国王

用法：
  python scripts/gen-card-stubs.py            # 写入 src/data/cards.json
  python scripts/gen-card-stubs.py --stdout   # 打印到标准输出
"""

import json
import sys
from pathlib import Path

SUITS = ["wands", "cups", "swords", "pentacles"]
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "cards.json"


def major_stub(number: int) -> dict:
    return {
        "id": f"major-{number:02d}",
        "name": "",
        "nameEn": "",
        "arcana": "major",
        "number": number,
        "element": "",
        "astro": "",
        "keywords": {"upright": [], "reversed": []},
        "meaning": {"upright": "", "reversed": ""},
        "domains": {
            "love": {"upright": "", "reversed": ""},
            "career": {"upright": "", "reversed": ""},
            "wealth": {"upright": "", "reversed": ""},
            "study": {"upright": "", "reversed": ""},
        },
        "symbols": "",
    }


def minor_stub(suit: str, number: int) -> dict:
    return {
        "id": f"{suit}-{number:02d}",
        "name": "",
        "nameEn": "",
        "arcana": suit,
        "number": number,
        "element": "",
        "keywords": {"upright": [], "reversed": []},
        "meaning": {"upright": "", "reversed": ""},
    }


def main() -> None:
    cards = [major_stub(n) for n in range(22)]
    for suit in SUITS:
        cards.extend(minor_stub(suit, n) for n in range(1, 15))

    text = json.dumps(cards, ensure_ascii=False, indent=2) + "\n"
    if "--stdout" in sys.argv:
        sys.stdout.write(text)
        return

    OUT.parent.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        print(f"!! {OUT} 已存在，未覆盖（删除后重跑以重新生成）")
        sys.exit(1)
    OUT.write_text(text, encoding="utf-8")
    print(f"已生成 {len(cards)} 条桩数据 -> {OUT}")


if __name__ == "__main__":
    main()
