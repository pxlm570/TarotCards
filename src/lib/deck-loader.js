// 皮肤（牌组）加载：全项目取牌面图只走这一个模块。
// URL 一律以 import.meta.env.BASE_URL 为前缀——部署在 /TarotCards/ 子路径（GitHub Pages），
// 硬编码 /decks/... 会全部 404。
// 静态托管无目录列举能力：可用皮肤靠 public/decks/index.json 索引（新皮肤须注册进去）。
const BASE = import.meta.env.BASE_URL

const manifestCache = new Map()
let deckIdsCache = null

export async function listDecks() {
  if (deckIdsCache) return deckIdsCache
  const res = await fetch(`${BASE}decks/index.json`)
  if (!res.ok) throw new Error(`加载皮肤索引失败：${res.status}`)
  deckIdsCache = await res.json()
  return deckIdsCache
}

export async function loadDeck(id) {
  if (manifestCache.has(id)) return manifestCache.get(id)
  const res = await fetch(`${BASE}decks/${id}/manifest.json`)
  if (!res.ok) throw new Error(`加载皮肤 ${id} 失败：${res.status}`)
  const manifest = await res.json()
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
