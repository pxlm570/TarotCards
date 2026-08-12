// useDeck 皮肤单例：初始加载 + M2 皮肤切换（switchDeck 写 settings.deckId 并重载 manifest）。
// 模块级单例状态跨用例残留 → 每个用例前 resetModules + 动态 import 拿全新模块实例。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

function jsonResponse(body, status = 200) {
  return { ok: status === 200, status, json: async () => body }
}

function mockFetch(manifests) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const u = String(url)
      if (u.includes('/decks/index.json')) {
        return jsonResponse(Object.keys(manifests))
      }
      const m = u.match(/\/decks\/([^/]+)\/manifest\.json/)
      if (m && manifests[m[1]]) return jsonResponse(manifests[m[1]])
      return jsonResponse({ error: 'not found' }, 404)
    })
  )
}

const RWS = { id: 'rws', name: '经典韦特', back: 'back.webp', cards: { 'major-00': 'major-00.webp' } }
const SEPIA = { id: 'rws-sepia', name: '复古韦特', back: 'back.webp', cards: { 'major-00': 'major-00-sepia.webp' } }

let deck

describe('useDeck：皮肤加载与切换', () => {
  beforeEach(async () => {
    localStorage.clear()
    // 默认皮肤已是 rws-star；本测试聚焦 rws 的加载/切换，显式指定
    localStorage.setItem('tarot.settings.v1', JSON.stringify({ deckId: 'rws' }))
    vi.resetModules()
    mockFetch({ rws: RWS, 'rws-sepia': SEPIA })
    deck = await import('../src/lib/use-deck.js')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('首次 useDeck 加载默认皮肤 rws', async () => {
    const d = deck.useDeck()
    expect(d.deckId.value).toBe('rws')
    await vi.waitFor(() => expect(d.manifest.value).toEqual(RWS))
    expect(d.cardUrl('major-00')).toContain('/decks/rws/major-00.webp')
  })

  it('switchDeck 换皮肤后 manifest 更新且 settings.deckId 已写', async () => {
    const d = deck.useDeck()
    await vi.waitFor(() => expect(d.manifest.value).toEqual(RWS))

    d.switchDeck('rws-sepia')
    await vi.waitFor(() => expect(d.manifest.value).toEqual(SEPIA))
    expect(d.deckId.value).toBe('rws-sepia')
    expect(JSON.parse(localStorage.getItem('tarot.settings.v1')).deckId).toBe('rws-sepia')
    expect(d.cardUrl('major-00')).toContain('/decks/rws-sepia/major-00-sepia.webp')
  })

  it('切换到同一皮肤时不重复加载', async () => {
    const d = deck.useDeck()
    await vi.waitFor(() => expect(d.manifest.value).toEqual(RWS))
    const fetchCalls = () => fetch.mock.calls.length
    const before = fetchCalls()
    d.switchDeck('rws')
    expect(d.manifest.value).toEqual(RWS) // 同步保持，无重载
    expect(fetchCalls()).toBe(before)
  })

  it('加载失败的皮肤暴露 error，可切回', async () => {
    const d = deck.useDeck()
    await vi.waitFor(() => expect(d.manifest.value).toEqual(RWS))
    // 切到一个 manifest 不存在的皮肤 → 失败分支
    d.switchDeck('no-such')
    await vi.waitFor(() => expect(d.error.value).toBeTruthy())
    expect(d.manifest.value).toBeNull()
    // 切回正常皮肤可恢复
    d.switchDeck('rws')
    await vi.waitFor(() => expect(d.manifest.value).toEqual(RWS))
  })
})
