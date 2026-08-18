// 牌面收集统计（v1.5 Task 8）：从 journal readings 聚合各牌出现次数与正逆分布。
// 收藏馆「牌面收集墙」的数据源；纯函数、零新增存储（记录库淘汰最旧后统计自然收缩）。
export function collectionStats(readings) {
  const map = {}
  for (const reading of readings ?? []) {
    for (const c of reading.cards ?? []) {
      if (!c || typeof c.cardId !== 'string') continue
      const entry = (map[c.cardId] ??= { count: 0, upright: 0, reversed: 0 })
      entry.count++
      if (c.reversed) entry.reversed++
      else entry.upright++
    }
  }
  return map
}

/** 已点亮的牌数（以 cards.json 的 78 张为分母口径） */
export function collectedCount(stats, cardsData) {
  return cardsData.filter((c) => stats[c.id]?.count > 0).length
}
