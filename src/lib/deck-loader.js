// 皮肤（牌组）加载：全项目取牌面图只走这一个模块。
// URL 一律以 import.meta.env.BASE_URL 为前缀——部署在 /TarotCards/ 子路径（GitHub Pages），
// 硬编码 /decks/... 会全部 404。
// 静态托管无目录列举能力：可用皮肤靠 public/decks/index.json 索引（新皮肤须注册进去）。
const BASE = import.meta.env.BASE_URL

const manifestCache = new Map()
let deckIdsCache = null
let backsCache = null

export async function listDecks() {
  if (deckIdsCache) return deckIdsCache
  const res = await fetch(`${BASE}decks/index.json`)
  if (!res.ok) throw new Error(`加载皮肤索引失败：${res.status}`)
  const ids = await res.json()
  // 本地专属皮肤：public/decks/local-index.json 已 gitignore、不随仓库分发，
  // 与公开注册表合并去重；文件缺失/损坏按无本地皮肤处理
  try {
    const local = await fetch(`${BASE}decks/local-index.json`)
    if (local.ok) {
      const extra = await local.json()
      if (Array.isArray(extra)) for (const id of extra) if (!ids.includes(id)) ids.push(id)
    }
  } catch { /* 本地皮肤是可选能力 */ }
  deckIdsCache = ids
  return ids
}

// 牌背注册表（与牌面解耦，用户可自由组合）：[{ id, name, file }]
export async function listBacks() {
  if (backsCache) return backsCache
  const res = await fetch(`${BASE}backs/index.json`)
  if (!res.ok) throw new Error(`加载牌背索引失败：${res.status}`)
  backsCache = await res.json()
  return backsCache
}

export async function loadDeck(id, _seen = new Set()) {
  if (manifestCache.has(id)) return manifestCache.get(id)
  if (_seen.has(id)) throw new Error(`皮肤 cardsFrom 循环引用：${id}`) // A→B→A 会无限递归爆栈
  _seen.add(id)
  const res = await fetch(`${BASE}decks/${id}/manifest.json`)
  if (!res.ok) throw new Error(`加载皮肤 ${id} 失败：${res.status}`)
  const manifest = await res.json()
  // 皮肤可复用另一套皮肤的牌面图（只换牌背）：cardsFrom 指向基础皮肤 id
  if (manifest.cardsFrom) {
    const base = await loadDeck(manifest.cardsFrom, _seen)
    manifest.cards = base.cards
  }
  manifestCache.set(id, manifest)
  return manifest
}

// 牌面 URL 带内容版本号（缓存破解）：牌面图走 SW CacheFirst 运行时缓存，重绘后
// 文件名不变 -> URL 不变 -> 旧缓存 30 天不失效，用户永远看到旧图（2026-08-31 夜城小牌事件）。
// manifest.v 由生图脚本 register() 按卡面内容哈希写入；重绘即换 v 即换 URL，旧缓存自然失效。
export function cardImageUrl(manifest, cardId) {
  const file = manifest.cards[cardId]
  if (!file) throw new Error(`皮肤 ${manifest.id} 缺少牌面：${cardId}`)
  const v = manifest.v ? `?v=${manifest.v}` : ''
  return `${BASE}decks/${manifest.id}/${file}${v}`
}

// 独立牌背图（不依赖某套牌面皮肤）；back.v 同为内容版本号（backs/index.json 条目可选字段）
export function standaloneBackUrl(back) {
  const v = back.v ? `?v=${back.v}` : ''
  return `${BASE}backs/${back.file}${v}`
}
