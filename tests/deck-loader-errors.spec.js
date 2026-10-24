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

  it('listDecks：local-index.json 返回非数组（脏数据）时忽略，基础列表原样', async () => {
    // 本地索引是可选文件，内容坏了同样按「无本地皮肤」处理，不许污染公开注册表
    vi.stubGlobal('fetch', vi.fn((url) => String(url).includes('/decks/local-index.json')
      ? jsonResponse({ broken: true })
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

// cardsFrom 成功路径（换背不换面的皮肤包机制）：继承基底 cards、保留自身 back，
// 二次加载命中 manifest 缓存不再发请求。循环引用失败分支见 use-deck.spec。
describe('deck-loader cardsFrom 继承', () => {
  beforeEach(async () => {
    vi.resetModules()
    loader = await import('../src/lib/deck-loader.js')
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const u = String(url)
      if (u.includes('/decks/base-a/manifest.json')) {
        return jsonResponse({ id: 'base-a', name: '基底', back: 'a-back.webp', cards: { 'major-00': 'm0.webp' } })
      }
      if (u.includes('/decks/skin-b/manifest.json')) {
        return jsonResponse({ id: 'skin-b', name: '只换背', back: 'b-back.webp', cardsFrom: 'base-a' })
      }
      return jsonResponse({ error: 'not found' }, 404)
    }))
  })

  it('cardsFrom 指向基底：cards 继承、back 与 id 保留自身；缓存命中不重拉', async () => {
    const b = await loader.loadDeck('skin-b')
    expect(b.cards).toEqual({ 'major-00': 'm0.webp' })
    expect(b.back).toBe('b-back.webp')
    expect(b.id).toBe('skin-b')
    // 文件名随基底、URL 路径随皮肤自己
    expect(loader.cardImageUrl(b, 'major-00')).toBe('/decks/skin-b/m0.webp')
    await loader.loadDeck('skin-b')
    expect(vi.mocked(globalThis.fetch).mock.calls).toHaveLength(2) // 两份 manifest 各一次
  })
})
