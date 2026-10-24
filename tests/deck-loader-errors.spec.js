// deck-loader 错误路径直测：索引/manifest 非 2xx 与缺牌面时的报错语义。
// 模块级缓存（manifestCache/deckIdsCache/backsCache）跨用例残留 → 每例 resetModules + 动态 import。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

function jsonResponse(body, status = 200) {
  return { ok: status === 200, status, json: async () => body }
}

let loader

describe('deck-loader 错误路径', () => {
  beforeEach(async () => {
    vi.resetModules()
    loader = await import('../src/lib/deck-loader.js')
  })

  afterEach(() => vi.unstubAllGlobals())

  it('listDecks：皮肤索引非 2xx 时抛「加载皮肤索引失败」', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'boom' }, 500)))
    await expect(loader.listDecks()).rejects.toThrow('加载皮肤索引失败：500')
  })

  it('listBacks：牌背索引非 2xx 时抛「加载牌背索引失败」', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'boom' }, 404)))
    await expect(loader.listBacks()).rejects.toThrow('加载牌背索引失败：404')
  })

  it('listDecks：local-index.json 网络异常时按无本地皮肤处理', async () => {
    // 区别于 404：fetch 直接 reject（网络断开）也要静默跳过，不拖垮皮肤列表
    vi.stubGlobal('fetch', vi.fn((url) => String(url).includes('/decks/local-index.json')
      ? Promise.reject(new Error('网络断开'))
      : jsonResponse(['rws'])))
    await expect(loader.listDecks()).resolves.toEqual(['rws'])
  })

  it('loadDeck：manifest 非 2xx 时报错带皮肤 id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'boom' }, 500)))
    await expect(loader.loadDeck('rws')).rejects.toThrow('加载皮肤 rws 失败：500')
  })

  it('cardImageUrl：manifest 缺该牌的牌面时抛「缺少牌面」', () => {
    const manifest = { id: 'rws', cards: { 'major-00': 'major-00.webp' } }
    expect(() => loader.cardImageUrl(manifest, 'cups-05')).toThrow('皮肤 rws 缺少牌面：cups-05')
  })
})
