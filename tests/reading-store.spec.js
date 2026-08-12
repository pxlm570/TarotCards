import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useReadingStore } from '../src/stores/reading.js'
import { FLOW_KEY, DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/lib/storage.js'
import spreads from '../src/data/spreads.json'

const SPREAD_3 = 'time-flow' // 3 张
const SPREAD_10 = 'celtic-cross' // 10 张

function walkToPicking(store, spreadId = SPREAD_3) {
  store.selectSpread(spreadId)
  store.beginBreathing()
  store.toQuestion()
  store.submitQuestion('测试问题', 'career')
  store.finishShuffle()
}

describe('storage：settings 契约', () => {
  beforeEach(() => localStorage.clear())

  it('默认值 schema 完整（tarot.settings.v1 契约）', () => {
    const s = loadSettings()
    expect(s).toEqual(DEFAULT_SETTINGS)
    expect(s.reversalsEnabled).toBe(false) // 新手默认关逆位
    expect(s.autoDraw).toBe(false)
    expect(s.sound).toBe(false)
    expect(s.deckId).toBe('rws-star')
  })

  it('saveSettings 增量合并并持久化', () => {
    saveSettings({ reversalsEnabled: true })
    expect(loadSettings().reversalsEnabled).toBe(true)
    expect(loadSettings().autoDraw).toBe(false)
    expect(JSON.parse(localStorage.getItem('tarot.settings.v1')).reversalsEnabled).toBe(true)
  })

  it('localStorage 内容损坏时回退默认值', () => {
    localStorage.setItem('tarot.settings.v1', '{broken json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('reading store：状态机', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    localStorage.clear()
  })

  it('完整合法流转：idle→…→interpreting', () => {
    const store = useReadingStore()
    expect(store.phase).toBe('idle')
    store.selectSpread(SPREAD_3)
    expect(store.phase).toBe('spreadSelected')
    store.beginBreathing()
    expect(store.phase).toBe('breathing')
    store.toQuestion()
    expect(store.phase).toBe('questioning')
    store.submitQuestion('我的事业方向？', 'career')
    expect(store.phase).toBe('shuffling')
    expect(store.question).toBe('我的事业方向？')
    expect(store.domain).toBe('career')
    store.finishShuffle()
    expect(store.phase).toBe('picking')
    store.pickCard(0)
    store.pickCard(5)
    store.pickCard(12)
    expect(store.phase).toBe('revealing')
    store.revealCard('past')
    store.revealCard('future')
    store.revealCard('present')
    expect(store.revealedCount).toBe(3)
    store.goInterpret()
    expect(store.phase).toBe('interpreting')
  })

  it('revealCard 记录具体位置：拒绝重复与未知位置，乱序合法', () => {
    const store = useReadingStore()
    walkToPicking(store)
    store.pickAll()
    store.revealCard('future')
    expect(store.revealedKeys).toEqual(['future'])
    expect(store.revealedCount).toBe(1)
    expect(() => store.revealCard('future')).toThrow()
    expect(() => store.revealCard('no-such-key')).toThrow()
  })

  it('非法跳转抛错', () => {
    const store = useReadingStore()
    expect(() => store.finishShuffle()).toThrow()
    expect(() => store.submitQuestion('x', null)).toThrow()
    expect(() => store.pickCard(0)).toThrow()
    store.selectSpread(SPREAD_3)
    expect(() => store.goInterpret()).toThrow()
  })

  it('selectSpread 拒绝未知牌阵 id', () => {
    const store = useReadingStore()
    expect(() => store.selectSpread('no-such-spread')).toThrow()
  })

  it('picking 时预抽完成：牌数=cardCount、不重复、按位置映射', () => {
    const store = useReadingStore()
    walkToPicking(store, SPREAD_10)
    store.pickAll()
    const spread = spreads.find((s) => s.id === SPREAD_10)
    expect(store.drawn).toHaveLength(10)
    const ids = store.drawn.map((d) => d.cardId)
    expect(new Set(ids).size).toBe(10)
    ids.forEach((id) => expect(id).toMatch(/^(major|wands|cups|swords|pentacles)-\d{2}$/))
    expect(store.drawn.map((d) => d.positionKey)).toEqual(spread.positions.map((p) => p.key))
  })

  it('pickCard 同一牌背不可重复点选', () => {
    const store = useReadingStore()
    walkToPicking(store)
    store.pickCard(7)
    expect(() => store.pickCard(7)).toThrow()
  })

  it('默认设置下（逆位关）抽出的牌全部正位', () => {
    const store = useReadingStore()
    walkToPicking(store, SPREAD_10)
    store.pickAll()
    store.drawn.forEach((d) => expect(d.reversed).toBe(false))
  })

  it('逆位开关快照：开启后 drawn 带布尔 reversed', () => {
    saveSettings({ reversalsEnabled: true })
    const store = useReadingStore()
    walkToPicking(store, SPREAD_10)
    store.pickAll()
    store.drawn.forEach((d) => expect(typeof d.reversed).toBe('boolean'))
  })

  it('代抽（autoDraw）进入 picking 即自动填满并进 revealing', () => {
    saveSettings({ autoDraw: true })
    const store = useReadingStore()
    walkToPicking(store)
    expect(store.phase).toBe('revealing')
    expect(store.drawn).toHaveLength(3)
  })

  it('revealAll 一键全翻 + goInterpret 守卫（未翻完抛错）', () => {
    const store = useReadingStore()
    walkToPicking(store)
    store.pickAll()
    store.revealCard('present')
    expect(() => store.goInterpret()).toThrow()
    store.revealAll()
    expect(store.revealedCount).toBe(3)
    store.goInterpret()
    expect(store.phase).toBe('interpreting')
  })

  it('reset 回到 idle 并清空 sessionStorage', () => {
    const store = useReadingStore()
    walkToPicking(store)
    store.pickAll()
    store.reset()
    expect(store.phase).toBe('idle')
    expect(store.drawn).toEqual([])
    expect(store.question).toBe('')
    expect(sessionStorage.getItem(FLOW_KEY)).toBeNull()
  })

  it('流程态持久化到 sessionStorage 且新 store 可恢复（防误刷新，含乱序翻牌记录）', () => {
    const store = useReadingStore()
    walkToPicking(store)
    store.pickAll()
    store.revealCard('future')
    const saved = sessionStorage.getItem(FLOW_KEY)
    expect(saved).toBeTruthy()

    setActivePinia(createPinia())
    const restored = useReadingStore()
    expect(restored.tryRestore()).toBe(true)
    expect(restored.phase).toBe('revealing')
    expect(restored.spreadId).toBe(SPREAD_3)
    expect(restored.question).toBe('测试问题')
    expect(restored.drawn).toEqual(store.drawn)
    expect(restored.revealedKeys).toEqual(['future'])
  })

  it('sessionStorage 无数据时 tryRestore 返回 false', () => {
    const store = useReadingStore()
    expect(store.tryRestore()).toBe(false)
    expect(store.phase).toBe('idle')
  })

  it('domain 枚举校验：非法值抛错，null（随心抽）合法', () => {
    const store = useReadingStore()
    store.selectSpread(SPREAD_3)
    store.beginBreathing()
    store.toQuestion()
    expect(() => store.submitQuestion('x', 'money')).toThrow()
    store.submitQuestion('', null)
    expect(store.phase).toBe('shuffling')
    expect(store.domain).toBeNull()
  })
})
