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

export async function loadDeck(id) {
  if (manifestCache.has(id)) return manifestCache.get(id)
  const res = await fetch(`${BASE}decks/${id}/manifest.json`)
  if (!res.ok) throw new Error(`加载皮肤 ${id} 失败：${res.status}`)
  const manifest = await res.json()
  // 皮肤可复用另一套皮肤的牌面图（只换牌背）：cardsFrom 指向基础皮肤 id
  if (manifest.cardsFrom) {
    const base = await loadDeck(manifest.cardsFrom)
    manifest.cards = base.cards
  }
  manifestCache.set(id, manifest)
  return manifest
}

export function cardImageUrl(manifest, cardId) {
  const file = manifest.cards[cardId]
  if (!file) throw new Error(`皮肤 ${manifest.id} 缺少牌面：${cardId}`)
  return `${BASE}decks/${manifest.id}/${file}`
}

export function backImageUrl(manifest) {
  return `${BASE}decks/${manifest.id}/${manifest.back}`
}

// 独立牌背图（不依赖某套牌面皮肤）
export function standaloneBackUrl(back) {
  return `${BASE}backs/${back.file}`
}
