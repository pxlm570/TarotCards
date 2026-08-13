// useDeck 单例：牌面(face) 与 牌背(back) 独立加载与切换。
// 模块级单例状态跨用例残留 → 每个用例前 resetModules + 动态 import 拿全新模块实例。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

function jsonResponse(body, status = 200) {
  return { ok: status === 200, status, json: async () => body }
}

function mockFetch(manifests, backs) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const u = String(url)
      if (u.includes('/decks/index.json')) return jsonResponse(Object.keys(manifests))
      if (u.includes('/backs/index.json')) return jsonResponse(backs)
      const m = u.match(/\/decks\/([^/]+)\/manifest\.json/)
      if (m && manifests[m[1]]) return jsonResponse(manifests[m[1]])
      return jsonResponse({ error: 'not found' }, 404)
    })
  )
}

const RWS = { id: 'rws', name: '经典韦特', back: 'back.webp', cards: { 'major-00': 'major-00.webp' } }
const SEPIA = { id: 'rws-sepia', name: '复古韦特', back: 'back.webp', cards: { 'major-00': 'major-00-sepia.webp' } }
const BACKS = [
  { id: 'star-gold', name: '星纹·暖金', file: 'star-gold.webp' },
  { id: 'neon', name: '霓虹壁画', file: 'neon.webp' }
]

let deck

describe('useDeck：牌面/牌背独立', () => {
  beforeEach(async () => {
    localStorage.clear()
    localStorage.setItem('tarot.settings.v1', JSON.stringify({ deckId: 'rws', backId: 'star-gold' }))
    vi.resetModules()
    mockFetch({ rws: RWS, 'rws-sepia': SEPIA }, BACKS)
    deck = await import('../src/lib/use-deck.js')
  })

  afterEach(() => vi.unstubAllGlobals())

  it('默认加载牌面 rws 与牌背 star-gold', async () => {
    const d = deck.useDeck()
    expect(d.faceId.value).toBe('rws')
    expect(d.backId.value).toBe('star-gold')
    await vi.waitFor(() => expect(d.manifest.value).toEqual(RWS))
    await vi.waitFor(() => expect(d.backItem.value?.id).toBe('star-gold'))
    expect(d.cardUrl('major-00')).toContain('/decks/rws/major-00.webp')
    expect(d.backUrl()).toContain('/backs/star-gold.webp')
  })

  it('switchFace 换牌面不影响牌背', async () => {
    const d = deck.useDeck()
    await vi.waitFor(() => expect(d.manifest.value).toEqual(RWS))
    d.switchFace('rws-sepia')
    await vi.waitFor(() => expect(d.manifest.value).toEqual(SEPIA))
    expect(d.cardUrl('major-00')).toContain('/decks/rws-sepia/major-00-sepia.webp')
    // 牌背不变
    expect(d.backId.value).toBe('star-gold')
    expect(JSON.parse(localStorage.getItem('tarot.settings.v1')).deckId).toBe('rws-sepia')
  })

  it('switchBack 换牌背不影响牌面', async () => {
    const d = deck.useDeck()
    await vi.waitFor(() => expect(d.manifest.value).toEqual(RWS))
    d.switchBack('neon')
    await vi.waitFor(() => expect(d.backItem.value?.id).toBe('neon'))
    expect(d.backUrl()).toContain('/backs/neon.webp')
    expect(d.faceId.value).toBe('rws')
    expect(JSON.parse(localStorage.getItem('tarot.settings.v1')).backId).toBe('neon')
  })

  it('缺失的 backId 回退到注册表第一项', async () => {
    localStorage.setItem('tarot.settings.v1', JSON.stringify({ deckId: 'rws', backId: 'no-such' }))
    vi.resetModules()
    deck = await import('../src/lib/use-deck.js')
    const d = deck.useDeck()
    await vi.waitFor(() => expect(d.backItem.value).toBeTruthy())
    expect(d.backItem.value.id).toBe('star-gold') // 回退第一项
  })
})
