#!/usr/bin/env bash
# 一次性脚本：从 Wikimedia Commons 下载 RWS 1909 公有领域扫描件（78 张）
# 用法: bash scripts/download-deck.sh
set -e
cd "$(dirname "$0")/.."
mkdir -p public/decks/rws/raw
BASE="https://commons.wikimedia.org/wiki/Special:FilePath"

MAJORS=(00_Fool 01_Magician 02_High_Priestess 03_Empress 04_Emperor 05_Hierophant 06_Lovers 07_Chariot 08_Strength 09_Hermit 10_Wheel_of_Fortune 11_Justice 12_Hanged_Man 13_Death 14_Temperance 15_Devil 16_Tower 17_Star 18_Moon 19_Sun 20_Judgement 21_World)
for m in "${MAJORS[@]}"; do
  curl -sL --retry 3 -o "public/decks/rws/raw/RWS_Tarot_${m}.jpg" "${BASE}/RWS_Tarot_${m}.jpg"
done
for suit in Wands Cups Swords Pents; do
  for n in $(seq -w 1 14); do
    curl -sL --retry 3 -o "public/decks/rws/raw/${suit}${n}.jpg" "${BASE}/${suit}${n}.jpg"
  done
done

count=$(ls public/decks/rws/raw | wc -l)
[ "$count" -eq 78 ] || { echo "数量不为 78（实际 $count），逐张核对失败项"; exit 1; }

# 校验 JPEG 文件头（FF D8），防止下到 HTML 错误页
bad=0
for f in public/decks/rws/raw/*.jpg; do
  if [ "$(head -c2 "$f" | xxd -p)" != "ffd8" ]; then
    echo "非 JPEG: $f"
    bad=1
  fi
done
[ "$bad" -eq 0 ] || { echo "存在无效文件，请修正脚本后重跑"; exit 1; }
echo "OK: 78 张全部下载且为有效 JPEG"
