// useDeck 单例：牌面(face) 与 牌背(back) 独立加载与切换。
// 模块级单例状态跨用例残留 → 每个用例前 resetModules + 动态 import 拿全新模块实例。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cardImageUrl, standaloneBackUrl } from '../src/lib/deck-loader.js'

function jsonResponse(body, status = 200) {
  return { ok: status === 200, status, json: async () => body }
}

function mockFetch(manifests, backs, localIndex, publicIds) {
  // publicIds 缺省取全部 manifest key；本地皮肤用例显式传入不含本地项的公开索引
  const ids = publicIds ?? Object.keys(manifests)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const u = String(url)
      if (u.includes('/decks/local-index.json')) {
        return localIndex ? jsonResponse(localIndex) : jsonResponse({ error: 'not found' }, 404)
      }
      if (u.includes('/decks/index.json')) return jsonResponse(ids)
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

  it('快速切换皮肤后，较早请求晚到不能覆盖当前选择', async () => {
    let resolveRws
    const priorFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn((url) => String(url).includes('/rws/manifest.json')
      ? new Promise((resolve) => { resolveRws = resolve }) : priorFetch(url)))
    const d = deck.useDeck()
    await vi.waitFor(() => expect(resolveRws).toBeTypeOf('function'))
    d.switchFace('rws-sepia')
    await vi.waitFor(() => expect(d.manifest.value).toEqual(SEPIA))
    resolveRws(jsonResponse(RWS))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(d.faceId.value).toBe('rws-sepia')
    expect(d.manifest.value).toEqual(SEPIA)
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

  it('deckId 指向已移除皮肤时回退 rws 并写回 settings', async () => {
    // mock 索引里没有 rws-star（已被移除）
    localStorage.setItem('tarot.settings.v1', JSON.stringify({ deckId: 'rws-star', backId: 'star-gold' }))
    vi.resetModules()
    deck = await import('../src/lib/use-deck.js')
    const d = deck.useDeck()
    await vi.waitFor(() => expect(d.manifest.value).toEqual(RWS))
    expect(d.faceId.value).toBe('rws')
    expect(JSON.parse(localStorage.getItem('tarot.settings.v1')).deckId).toBe('rws')
  })

  it('牌面加载失败：error 置位且 cardUrl 安全空串，retry() 恢复后清 error', async () => {
    const goodFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn((url) => String(url).includes('/decks/index.json')
      ? Promise.reject(new Error('网络断开'))
      : goodFetch(url)))
    const d = deck.useDeck()
    expect(d.backUrl()).toBe('') // 牌背尚未就绪时的安全空串
    await vi.waitFor(() => expect(d.error.value).toBeTruthy())
    expect(d.manifest.value).toBeNull()
    expect(d.cardUrl('major-00')).toBe('') // 无 manifest 时不抛崩
    // 网络恢复后 retry 重载成功，error 清空
    vi.stubGlobal('fetch', goodFetch)
    d.retry()
    await vi.waitFor(() => expect(d.manifest.value).toEqual(RWS))
    expect(d.error.value).toBeNull()
    expect(d.cardUrl('major-00')).toContain('/decks/rws/major-00.webp')
    expect(d.cardUrl('no-such-card')).toBe('') // 未知牌 id 回空串而非抛崩
  })

  it('牌背加载失败：backItem 保持 null 且 backUrl 空串，恢复后重进可重试', async () => {
    const goodFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn((url) => String(url).includes('/backs/index.json')
      ? Promise.reject(new Error('网络断开'))
      : goodFetch(url)))
    const d = deck.useDeck()
    await vi.waitFor(() => expect(d.manifest.value).toEqual(RWS)) // 牌面不受牌背失败影响
    await new Promise((resolve) => setTimeout(resolve, 0)) // 让牌背请求失败落地
    expect(d.backItem.value).toBeNull()
    expect(d.backUrl()).toBe('')
    // backsLoading 已在 finally 清零 → 下次进入页面自动重试
    vi.stubGlobal('fetch', goodFetch)
    deck.useDeck()
    await vi.waitFor(() => expect(d.backItem.value?.id).toBe('star-gold'))
    expect(d.backUrl()).toContain('/backs/star-gold.webp')
  })

  it('cardsFrom 循环引用时抛明确错误而非无限递归（审查修复）', async () => {
    vi.resetModules()
    mockFetch(
      {
        rws: RWS,
        a: { id: 'a', name: 'A', cardsFrom: 'b' },
        b: { id: 'b', name: 'B', cardsFrom: 'a' }
      },
      BACKS
    )
    const loader = await import('../src/lib/deck-loader.js')
    await expect(loader.loadDeck('a')).rejects.toThrow('循环引用')
  })

  it('switchFace 同 id 且牌面已就绪：no-op，不重拉 manifest', async () => {
    const d = deck.useDeck()
    await vi.waitFor(() => expect(d.manifest.value).toEqual(RWS))
    const callsBefore = vi.mocked(globalThis.fetch).mock.calls.length
    d.switchFace('rws')
    expect(d.manifest.value).toEqual(RWS) // 幂等：不置空等待重载
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(callsBefore)
  })

  it('switchBack 同 id 且牌背已就绪：no-op，不重拉牌背注册表', async () => {
    const d = deck.useDeck()
    await vi.waitFor(() => expect(d.backItem.value?.id).toBe('star-gold'))
    const callsBefore = vi.mocked(globalThis.fetch).mock.calls.length
    d.switchBack('star-gold')
    expect(d.backItem.value?.id).toBe('star-gold')
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(callsBefore)
  })

  it('牌背请求进行中重复 useDeck()：backsLoading 守卫挡住重复请求', async () => {
    let resolveBacks
    let backsCalls = 0
    const priorFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (String(url).includes('/backs/index.json')) {
        backsCalls++
        return new Promise((resolve) => { resolveBacks = resolve })
      }
      return priorFetch(url)
    }))
    const d = deck.useDeck()
    deck.useDeck() // 牌背尚未就绪：同一次加载中重入不得重发
    expect(backsCalls).toBe(1)
    resolveBacks(jsonResponse(BACKS))
    await vi.waitFor(() => expect(d.backItem.value?.id).toBe('star-gold'))
    expect(backsCalls).toBe(1)
  })

  it('retry() 在牌面已就绪时 no-op，不发任何请求', async () => {
    const d = deck.useDeck()
    await vi.waitFor(() => expect(d.manifest.value).toEqual(RWS))
    const callsBefore = vi.mocked(globalThis.fetch).mock.calls.length
    d.retry()
    expect(d.manifest.value).toEqual(RWS)
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(callsBefore)
  })

  it('换皮肤后旧请求失败：error 不被旧请求污染，新皮肤正常就绪', async () => {
    let rejectFirstIndex
    let indexCalls = 0
    const priorFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (String(url).includes('/decks/index.json')) {
        indexCalls++
        return indexCalls === 1
          ? new Promise((_, reject) => { rejectFirstIndex = reject })
          : jsonResponse(['rws', 'rws-sepia'])
      }
      return priorFetch(url)
    }))
    const d = deck.useDeck()
    await vi.waitFor(() => expect(indexCalls).toBe(1))
    d.switchFace('rws-sepia') // 旧索引请求还在路上时换皮肤
    await vi.waitFor(() => expect(indexCalls).toBe(2))
    rejectFirstIndex(new Error('旧请求网络断开'))
    await vi.waitFor(() => expect(d.manifest.value).toEqual(SEPIA))
    await new Promise((resolve) => setTimeout(resolve, 0)) // 让旧链路的 rejection 走完
    expect(d.error.value).toBeNull() // 失败的是已作废的请求，不得置 error
    expect(d.faceId.value).toBe('rws-sepia')
  })

  it('local-index.json 存在时本地皮肤并入列表（与公开索引去重），缺失时静默跳过', async () => {
    const LOCAL = { id: 'my-local', name: '本地皮肤', back: 'back.webp', cards: { 'major-00': 'm0.webp' } }
    vi.resetModules()
    mockFetch(
      { rws: RWS, 'rws-sepia': SEPIA, 'my-local': LOCAL },
      BACKS,
      ['my-local', 'rws'], // rws 重复出现，验证去重
      ['rws', 'rws-sepia'] // 公开索引不含本地皮肤
    )
    const loader = await import('../src/lib/deck-loader.js')
    await expect(loader.listDecks()).resolves.toEqual(['rws', 'rws-sepia', 'my-local'])
    const m = await loader.loadDeck('my-local')
    expect(m.id).toBe('my-local')
  })
})

describe('cardImageUrl / standaloneBackUrl：版本号破缓存', () => {
  // 2026-08-31 夜城小牌事件：卡面图走 SW CacheFirst，文件重绘但 URL 不变 -> 旧缓存 30 天不失效。
  // 修复：manifest.v / back.v -> URL 带 ?v=。有 v 拼 v，无 v 保持原样（向后兼容旧皮肤）。
  it('manifest 带 v 时牌面 URL 带 ?v=', () => {
    const url = cardImageUrl({ id: 'night-mural', cards: { 'cups-05': 'cups-05.webp' }, v: 'd42d242b73d8' }, 'cups-05')
    expect(url).toContain('/decks/night-mural/cups-05.webp?v=d42d242b73d8')
  })

  it('manifest 无 v 时 URL 不带查询串（向后兼容）', () => {
    const url = cardImageUrl({ id: 'rws', cards: { 'major-00': 'major-00.webp' } }, 'major-00')
    expect(url).toBe('/decks/rws/major-00.webp')
  })

  it('牌背条目带 v 时 URL 带 ?v=，无 v 保持原样', () => {
    expect(standaloneBackUrl({ file: 'night-mural.webp', v: 'cf207b847f91' })).toContain(
      '/backs/night-mural.webp?v=cf207b847f91'
    )
    expect(standaloneBackUrl({ file: 'star-gold.webp' })).toBe('/backs/star-gold.webp')
  })
})
