import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useReadingStore } from '../src/stores/reading.js'
import { saveReading as journalSave, getById as journalGetById } from '../src/lib/journal-store.js'
import { FLOW_KEY, DEFAULT_SETTINGS, loadSettings, saveSettings, saveFlow, clearFlow } from '../src/lib/storage.js'
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
    expect(s.deckId).toBe('rws')
    expect(s.backId).toBe('star-gold')
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

  it('entryPath：开局记入口页随 flow 持久化，恢复不覆盖，reset 清空（「从哪进、退回哪」）', () => {
    const store = useReadingStore()
    store.selectSpread(SPREAD_3)
    expect(store.entryPath).toBe('')
    store.setEntryPath('/spreads')
    expect(store.entryPath).toBe('/spreads')
    // 立即持久化：question 页刷新后恢复也带着入口
    expect(JSON.parse(sessionStorage.getItem(FLOW_KEY)).entryPath).toBe('/spreads')

    // 已有值不覆盖（恢复中的局再次挂载提问页不会误改入口）
    store.setEntryPath('/')
    expect(store.entryPath).toBe('/spreads')
    // 空值忽略（直链进入 history.state.back 为 null）
    store.setEntryPath('')
    expect(store.entryPath).toBe('/spreads')

    // 新 store 恢复：entryPath 跟着 flow 走
    setActivePinia(createPinia())
    const restored = useReadingStore()
    expect(restored.tryRestore()).toBe(true)
    expect(restored.entryPath).toBe('/spreads')

    // reset 清空，下一局重新捕获
    restored.reset()
    expect(restored.entryPath).toBe('')
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

  it('stepBack：interpreting→revealing→picking 逐级回退并清理中间态', () => {
    const store = useReadingStore()
    walkToPicking(store)
    store.pickAll()
    store.revealCard('past')
    store.revealAll()
    store.goInterpret()
    expect(store.phase).toBe('interpreting')
    expect(store.stepBack()).toBe('revealing')
    // revealing 回退到 picking：清空 revealedKeys 与已抽/待抽
    expect(store.stepBack()).toBe('picking')
    expect(store.revealedKeys).toEqual([])
    expect(store.drawn).toEqual([])
    expect(store.pending.length).toBe(store.cardCount) // 重建牌池，而非清空
    expect(store.pickedIndices).toEqual([])
  })

  it('stepBack 回退重抽时删除已落库记录并清 journalId（审查修复：防旧牌面留库）', () => {
    const store = useReadingStore()
    walkToPicking(store)
    store.pickAll()
    store.revealAll()
    store.goInterpret()
    // 模拟解读页已落库
    const recId = 'rec-stepback'
    journalSave({ id: recId, ts: 1, cards: store.drawn.map((d) => ({ cardId: d.cardId, positionKey: d.positionKey, reversed: d.reversed })) })
    store.journalId = recId
    expect(store.stepBack()).toBe('revealing') // 不重抽：记录保留
    expect(store.journalId).toBe(recId)
    expect(journalGetById(recId)).toBeTruthy()
    expect(store.stepBack()).toBe('picking') // 重抽：记录删除并失效
    expect(store.journalId).toBeNull()
    expect(journalGetById(recId)).toBeUndefined()
  })

  it('stepBack：picking→shuffling→questioning，问题保留；questioning 再退则重置', () => {
    const store = useReadingStore()
    walkToPicking(store) // 到 picking
    expect(store.stepBack()).toBe('shuffling')
    expect(store.stepBack()).toBe('questioning')
    expect(store.question).toBe('测试问题') // 问题未丢
    expect(store.stepBack()).toBeNull() // 无前一步 → 重置
    expect(store.phase).toBe('idle')
  })

  // Task 15：回退缺陷修复的三条必写用例（TDD Red）
  it('stepBack 回退到 picking 重建牌池：pickCard 正常放入不抛错', () => {
    const store = useReadingStore()
    walkToPicking(store)
    store.pickAll()
    store.revealCard('past')
    expect(store.stepBack()).toBe('picking') // revealing → picking
    expect(store.pending.length).toBe(store.cardCount) // 重建牌池
    expect(() => store.pickCard(0)).not.toThrow()
    store.pickCard(5)
    store.pickCard(12)
    expect(store.drawn.length).toBe(3)
    expect(store.phase).toBe('revealing')
  })

  it('stepBack 回退到 shuffling 清空已选：重洗后可完整选满', () => {
    const store = useReadingStore()
    walkToPicking(store)
    store.pickCard(0) // 已选 1 张
    expect(store.stepBack()).toBe('shuffling')
    expect(store.drawn).toEqual([])
    expect(store.pickedIndices).toEqual([])
    store.finishShuffle()
    expect(store.phase).toBe('picking')
    store.pickAll()
    expect(store.drawn.length).toBe(3)
    expect(store.phase).toBe('revealing')
  })

  it('stepBack 回退重抽仍按逆位快照', () => {
    saveSettings({ reversalsEnabled: true })
    const store = useReadingStore()
    walkToPicking(store, SPREAD_10)
    store.pickAll()
    store.revealCard('heart')
    store.stepBack() // revealing → picking
    expect(store.pending.length).toBe(10)
    expect(store.pending.some((p) => p.reversed)).toBe(true)
  })
})

// v1.5 Task 6：自定义牌阵接入动线（合并注册表 + flow 恢复兜底）
import { saveCustomSpread, deleteCustomSpread } from '../src/lib/custom-spreads.js'

describe('reading store：自定义牌阵（v1.5 Task 6）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    localStorage.clear()
  })

  function makeCustom() {
    return saveCustomSpread({
      name: '我的两张',
      positions: [
        { label: '因', x: 25, y: 35 },
        { label: '果', x: 75, y: 65 }
      ]
    })
  }

  it('selectSpread 接受 custom- 牌阵，spread getter 命中自定义库', () => {
    const store = useReadingStore()
    const saved = makeCustom()
    store.selectSpread(saved.id)
    expect(store.phase).toBe('spreadSelected')
    expect(store.spread.name).toBe('我的两张')
    expect(store.cardCount).toBe(2)
  })

  it('自定义牌阵完整动线走通：位置 key 命中归一后的 p1/p2', () => {
    const store = useReadingStore()
    const saved = makeCustom()
    walkToPicking(store, saved.id)
    store.pickAll()
    expect(store.drawn.map((d) => d.positionKey)).toEqual(['p1', 'p2'])
    store.revealAll()
    store.goInterpret()
    expect(store.phase).toBe('interpreting')
  })

  it('flow 恢复：自定义牌阵仍在则恢复成功', () => {
    const store = useReadingStore()
    const saved = makeCustom()
    walkToPicking(store, saved.id)
    store.pickAll()
    const fresh = useReadingStore // 换新 store 实例模拟刷新
    setActivePinia(createPinia())
    const restored = useReadingStore()
    expect(restored.tryRestore()).toBe(true)
    expect(restored.spreadId).toBe(saved.id)
    expect(restored.spread.name).toBe('我的两张')
  })

  it('flow 恢复兜底：自定义牌阵已删除 -> tryRestore 返回 false（守卫重定向首页）', () => {
    const store = useReadingStore()
    const saved = makeCustom()
    walkToPicking(store, saved.id)
    deleteCustomSpread(saved.id)
    setActivePinia(createPinia())
    const restored = useReadingStore()
    expect(restored.tryRestore()).toBe(false)
    expect(restored.phase).toBe('idle')
  })

  it('静态注册表不受影响：未知 id 仍拒绝', () => {
    const store = useReadingStore()
    expect(() => store.selectSpread('no-such-spread')).toThrow('未知牌阵')
  })
})

// v1.5 Task 7：自由摆放--翻牌后拖位，存为我的牌阵
import { getCustomSpread } from '../src/lib/custom-spreads.js'

describe('reading store：自由摆放（v1.5 Task 7）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    localStorage.clear()
  })

  it('selectFreeSpread：合成牌阵对象、p1..pN 位置、默认网格落位', () => {
    const store = useReadingStore()
    store.selectFreeSpread(3)
    expect(store.phase).toBe('spreadSelected')
    expect(store.freeMode).toBe(true)
    expect(store.spread.id).toBe('free')
    expect(store.spread.name).toBe('自由摆放')
    expect(store.spread.cardCount).toBe(3)
    expect(store.spread.positions.map((p) => p.key)).toEqual(['p1', 'p2', 'p3'])
    expect(store.spread.positions.every((p) => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100)).toBe(true)
  })

  it('张数越界拒绝', () => {
    const store = useReadingStore()
    expect(() => store.selectFreeSpread(0)).toThrow()
    expect(() => store.selectFreeSpread(11)).toThrow()
  })

  it('自由摆放完整动线 + moveFreePosition 更新坐标并持久化', () => {
    const store = useReadingStore()
    store.selectFreeSpread(2)
    store.beginBreathing()
    store.toQuestion()
    store.submitQuestion('随心一问', null)
    store.finishShuffle()
    store.pickAll()
    expect(store.phase).toBe('revealing')
    store.moveFreePosition('p2', 88, 12)
    expect(store.spread.positions.find((p) => p.key === 'p2').x).toBe(88)
    // 越界被夹紧
    store.moveFreePosition('p1', 120, -5)
    const p1 = store.spread.positions.find((p) => p.key === 'p1')
    expect(p1.x).toBeLessThanOrEqual(96)
    expect(p1.y).toBeGreaterThanOrEqual(4)
    // 持久化含自由摆放状态，刷新恢复
    setActivePinia(createPinia())
    const restored = useReadingStore()
    expect(restored.tryRestore()).toBe(true)
    expect(restored.freeMode).toBe(true)
    expect(restored.spread.positions.find((p) => p.key === 'p2').x).toBe(88)
  })

  it('moveFreePosition 只在自由摆放局可用', () => {
    const store = useReadingStore()
    walkToPicking(store, SPREAD_3)
    store.pickAll()
    expect(() => store.moveFreePosition('past', 50, 50)).toThrow()
  })

  it('摆位可存为自定义牌阵：位置与标签随摆法固化', () => {
    const store = useReadingStore()
    store.selectFreeSpread(2)
    store.beginBreathing()
    store.toQuestion()
    store.submitQuestion('', null)
    store.finishShuffle()
    store.pickAll()
    store.moveFreePosition('p2', 30, 70)
    const saved = saveCustomSpread({ name: '随心摆', positions: store.spread.positions })
    expect(getCustomSpread(saved.id).positions.find((p) => p.key === 'p2').y).toBe(70)
  })

  // ---- 坏 flow 兜底（评审 2026-09-03）：恢复不得把坏数据变成崩局，须回首页 ----
  function seedFlow(patch) {
    saveFlow({
      phase: 'picking', spreadId: SPREAD_3, question: '', domain: null,
      pending: [], pickedIndices: [], drawn: [], revealedKeys: [],
      snapshot: { reversalsEnabled: false, autoDraw: false },
      journalId: null, isDaily: false, freeMode: false, freePositions: [], entryPath: '',
      ...patch
    })
  }

  it('坏 flow：picking 阶段 pending 长度与牌阵不符 -> tryRestore false 并清掉坏 flow', () => {
    seedFlow({ pending: [{ id: 'major-00', reversed: false }] }) // 3 张阵只给 1 张
    setActivePinia(createPinia())
    expect(useReadingStore().tryRestore()).toBe(false)
    expect(sessionStorage.getItem(FLOW_KEY)).toBeNull()
  })

  it('坏 flow：pending 含未知牌 id -> false', () => {
    seedFlow({
      pending: [
        { id: 'major-00', reversed: false },
        { id: 'not-a-card', reversed: true },
        { id: 'major-02', reversed: false }
      ]
    })
    setActivePinia(createPinia())
    expect(useReadingStore().tryRestore()).toBe(false)
  })

  it('坏 flow：drawn 的 positionKey 不在牌阵里 -> false', () => {
    seedFlow({
      phase: 'revealing',
      pending: [
        { id: 'major-00', reversed: false },
        { id: 'major-01', reversed: false },
        { id: 'major-02', reversed: false }
      ],
      drawn: [{ cardId: 'major-00', reversed: false, positionKey: 'nope' }]
    })
    setActivePinia(createPinia())
    expect(useReadingStore().tryRestore()).toBe(false)
  })

  it('坏 flow：revealing 阶段 drawn 不满 -> false；revealedKeys 指向未落位牌 -> false', () => {
    const pool = [
      { id: 'major-00', reversed: false },
      { id: 'major-01', reversed: false },
      { id: 'major-02', reversed: false }
    ]
    seedFlow({
      phase: 'revealing',
      pending: pool,
      drawn: [{ cardId: 'major-00', reversed: false, positionKey: 'past' }]
    })
    setActivePinia(createPinia())
    expect(useReadingStore().tryRestore()).toBe(false)

    clearFlow()
    seedFlow({
      phase: 'revealing',
      pending: pool,
      drawn: [
        { cardId: 'major-00', reversed: false, positionKey: 'past' },
        { cardId: 'major-01', reversed: false, positionKey: 'present' },
        { cardId: 'major-02', reversed: false, positionKey: 'future' }
      ],
      revealedKeys: ['past', 'ghost'] // ghost 未落位
    })
    setActivePinia(createPinia())
    expect(useReadingStore().tryRestore()).toBe(false)
  })
})
