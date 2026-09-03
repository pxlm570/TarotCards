// 牌库页牌背/牌面切换列表的展示顺序（2026-09-03 用户拍板）。
// 纯函数：DeckView 渲染前排序，注册表（index.json）存储顺序不动。
// 牌背——已解锁排前、连胜锁款整体靠右；牌面（无锁）——按指定皮肤顺序、绚烂霓虹垫底。

// 牌背：两组各自保持注册表原序（稳定分区，不用 sort 以免依赖引擎稳定性）
export function orderBacks(list, isLocked) {
  const open = []
  const locked = []
  for (const b of list) (isLocked(b) ? locked : open).push(b)
  return [...open, ...locked]
}

// 牌面前段顺序：夜城两套居前、本地专属原画随其后（公开仓缺失该 id 时自然跳过）
const FACE_AHEAD = ['rws', 'rws-sepia', 'night-mural', 'cp2077-local']
// 垫底段：绚烂霓虹
const FACE_LAST = ['neon-glow']

export function orderFaces(list) {
  const rank = (id) => {
    const i = FACE_AHEAD.indexOf(id)
    if (i !== -1) return i
    const j = FACE_LAST.indexOf(id)
    if (j !== -1) return FACE_AHEAD.length + 1 + j
    return FACE_AHEAD.length // 未列入的新皮肤：按注册表序插在霓虹之前
  }
  return [...list].sort((a, b) => rank(a.id) - rank(b.id))
}
