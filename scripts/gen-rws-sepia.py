# -*- coding: utf-8 -*-
# 生成 rws-sepia 皮肤 + 连胜里程碑牌背变体（M5 Task 5，皮肤管线验证）。
# 对 rws 图做 sepia 滤镜，注册进 public/decks/index.json。
import json
import shutil
from pathlib import Path
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
RWS = ROOT / "public/decks/rws"
SEPIA = ROOT / "public/decks/rws-sepia"

# sepia 变换矩阵（RGB→RGB）
SEPIA_MATRIX = [
    0.393, 0.769, 0.189, 0,
    0.349, 0.686, 0.168, 0,
    0.272, 0.534, 0.131, 0,
]


def sepia(src, dst):
    im = Image.open(src).convert("RGB").convert("RGB", SEPIA_MATRIX)
    im = ImageEnhance.Brightness(im).enhance(1.05)
    im.save(dst, "WEBP", quality=80)


def main():
    SEPIA.mkdir(exist_ok=True)
    manifest = json.loads((RWS / "manifest.json").read_text(encoding="utf-8"))

    # 逐张生成 sepia 牌面 + 牌背
    for f in RWS.glob("*.webp"):
        sepia(f, SEPIA / f.name)

    # manifest：同文件名映射，换 id/name
    new_manifest = dict(manifest)
    new_manifest["id"] = "rws-sepia"
    new_manifest["name"] = "复古韦特（Sepia）"
    (SEPIA / "manifest.json").write_text(json.dumps(new_manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    # 注册进 index.json
    idx_path = ROOT / "public/decks/index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8"))
    if "rws-sepia" not in idx:
        idx.append("rws-sepia")
        idx_path.write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")

    # 连胜里程碑牌背：从 back.webp 做色调变体（7/30/100）
    back = Image.open(RWS / "back.webp").convert("RGB")
    tints = {
        "back-streak7.webp": (0.9, 0.85, 0.6),   # 暖金
        "back-streak30.webp": (0.9, 0.7, 0.65),  # 暖红
        "back-streak100.webp": (0.75, 0.8, 0.9), # 冷银
    }
    for name, (fr, fg, fb) in tints.items():
        r, g, b = back.split()
        from PIL import ImageChops
        tinted = Image.merge("RGB", (
            r.point(lambda p: int(p * fr)),
            g.point(lambda p: int(p * fg)),
            b.point(lambda p: int(p * fb)),
        ))
        tinted.save(SEPIA / name, "WEBP", quality=80)

    print("完成：", len(list(SEPIA.glob("*.webp"))), "张 rws-sepia；index.json =", idx)


if __name__ == "__main__":
    main()
