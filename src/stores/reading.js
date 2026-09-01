// 占卜流程状态机：idle → spreadSelected → breathing → questioning → shuffling → picking → revealing → interpreting
// 设计要点：
// - 进入 picking 时用 drawCards 一次性预抽（牌背不可区分，用户点选只做位置映射与仪式感）；
//   洗牌/切牌页是纯视觉层，不影响数据抽牌（crypto 真随机已保证公平）。
// - 每个改变状态的 action 结束时同步写 sessionStorage（payload < 2KB、每局仅十余次写入，
//   无需计划原文的 $subscribe 节流；同步写还能保证任意时刻刷新都不丢）。
// - 逆位/代抽在 finishShuffle 时快照，动线中途改设置不影响本局。
import { defineStore } from 'pinia'
import spreadsData from '../data/spreads.json'
import cardsData from '../data/cards.json'
import { drawCards } from '../lib/tarot-engine.js'
import { listCustomSpreads } from '../lib/custom-spreads.js'
import { deleteReading } from '../lib/journal-store.js'
import { loadSettings, loadFlow, saveFlow, clearFlow, DOMAIN_VALUES } from '../lib/storage.js'

const DECK_IDS = cardsData.map((c) => c.id)

// 合并注册表（v1.5 Task 6）：静态 spreads.json + 本机自定义牌阵；自定义被删时这里查不到，
// 动线内的兜底见 tryRestore（恢复失败回首页），选择入口的兜底见选牌阵页的删除确认
function findSpread(id) {
  return spreadsData.find((sp) => sp.id === id) ?? listCustomSpreads().find((sp) => sp.id === id) ?? null
}
const PHASES = [
  'idle',
  'spreadSelected',
  'breathing',
  'questioning',
  'shuffling',
  'picking',
  'revealing',
  'interpreting'
]

function initialState() {
  return {
    phase: 'idle',
    spreadId: null,
    question: '',
    domain: null,
    pending: [], // 预抽结果 [{ id, reversed }]，长度 = cardCount
    pickedIndices: [], // 用户点过的牌背下标（UI 动画 + 防重复点选）
    drawn: [], // 已落位 [{ cardId, reversed, positionKey }]
    revealedKeys: [], // 实际翻开的 positionKey（保序）--只存计数会让刷新恢复错位
    snapshot: null, // finishShuffle 时的设置快照 { reversalsEnabled, autoDraw }
    journalId: null, // M3：本局已写入记录库的 reading id（随 flow 持久化，一局只存一次）
    isDaily: false, // M3：每日一抽局（?daily=1），落库时打卡
    freeMode: false, // v1.5 Task 7：自由摆放局（翻牌后拖位，不依赖任何注册表牌阵）
    freePositions: [], // 自由摆放的活位置 [{key,label,meaning,x,y}]，随拖动更新并持久化
    entryPath: '' // 动线入口页（2026-08-31「从哪进、退回哪」）：开局在提问页捕获，退出/手势退出回这里
  }
}

// 自由摆放初始落位：最多 3 列的居中网格，翻开后拖动调整
function freeGridLayout(count) {
  const cols = Math.min(3, count)
  const rows = Math.ceil(count / cols)
  return Array.from({ length: count }, (_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      key: `p${i + 1}`,
      label: `第 ${i + 1} 张`,
      meaning: '',
      x: cols === 1 ? 50 : Math.round(20 + (60 * col) / (cols - 1)),
      y: rows === 1 ? 50 : Math.round(22 + (56 * row) / (rows - 1))
    }
  })
}

export const useReadingStore = defineStore('reading', {
  state: initialState,

  getters: {
    // 自由摆放局用 freePositions 合成牌阵对象（含拖动中的实时坐标）；其余走合并注册表
    spread(s) {
      if (this.freeMode && s.spreadId === 'free') {
        return { id: 'free', name: '自由摆放', cardCount: s.freePositions.length, positions: s.freePositions }
      }
      return findSpread(s.spreadId)
    },
    cardCount() {
      return this.spread ? this.spread.cardCount : 0
    },
    revealedCount: (s) => s.revealedKeys.length
  },

  actions: {
    _assert(expected, action) {
      if (this.phase !== expected) {
        throw new Error(`[reading] ${action} 需处于 ${expected} 阶段，当前 ${this.phase}`)
      }
    },

    selectSpread(spreadId) {
      this._assert('idle', 'selectSpread')
      if (!findSpread(spreadId)) {
        throw new Error(`[reading] 未知牌阵：${spreadId}`)
      }
      this.spreadId = spreadId
      this.phase = 'spreadSelected'
      this.persistNow()
    },

    // 自由摆放局（v1.5 Task 7）：不依赖注册表，位置在翻牌阶段拖动生成
    selectFreeSpread(count) {
      this._assert('idle', 'selectFreeSpread')
      if (!Number.isInteger(count) || count < 1 || count > 10) {
        throw new Error(`[reading] 自由摆放张数须为 1-10：${count}`)
      }
      this.freeMode = true
      this.freePositions = freeGridLayout(count)
      this.spreadId = 'free'
      this.phase = 'spreadSelected'
      this.persistNow()
    },

    // 翻牌后拖动摆位：夹紧安全区，防止拖出画布找不回
    moveFreePosition(key, x, y) {
      if (!this.freeMode || this.phase !== 'revealing') {
        throw new Error('[reading] moveFreePosition 仅自由摆放局的翻牌阶段可用')
      }
      const pos = this.freePositions.find((p) => p.key === key)
      if (!pos) throw new Error(`[reading] 未知自由摆放位置：${key}`)
      pos.x = Math.min(96, Math.max(4, Math.round(x * 10) / 10))
      pos.y = Math.min(96, Math.max(4, Math.round(y * 10) / 10))
      this.persistNow()
    },

    beginBreathing() {
      this._assert('spreadSelected', 'beginBreathing')
      this.phase = 'breathing'
      this.persistNow()
    },

    toQuestion() {
      this._assert('breathing', 'toQuestion')
      this.phase = 'questioning'
      this.persistNow()
    },

    submitQuestion(question, domain) {
      this._assert('questioning', 'submitQuestion')
      if (domain !== null && !DOMAIN_VALUES.includes(domain)) {
        throw new Error(`[reading] 非法领域：${domain}`)
      }
      this.question = question ?? ''
      this.domain = domain
      this.phase = 'shuffling'
      this.persistNow()
    },

    finishShuffle() {
      this._assert('shuffling', 'finishShuffle')
      const settings = loadSettings()
      this.snapshot = { reversalsEnabled: settings.reversalsEnabled, autoDraw: settings.autoDraw }
      this.pending = drawCards(DECK_IDS, this.cardCount, {
        allowReversed: this.snapshot.reversalsEnabled
      })
      this.phase = 'picking'
      if (this.snapshot.autoDraw) {
        this.pickAll()
      } else {
        this.persistNow()
      }
    },

    pickCard(index) {
      this._assert('picking', 'pickCard')
      if (!Number.isInteger(index) || index < 0 || index >= DECK_IDS.length) {
        throw new Error(`[reading] 非法牌背下标：${index}`)
      }
      if (this.pickedIndices.includes(index)) {
        throw new Error(`[reading] 牌背 ${index} 已被点选`)
      }
      this.pickedIndices.push(index)
      this._placeNext()
      this.persistNow()
    },

    // 「帮我抽完」/ 代抽：一键补满剩余位置
    pickAll() {
      this._assert('picking', 'pickAll')
      while (this.drawn.length < this.cardCount) this._placeNext()
      this.persistNow()
    },

    _placeNext() {
      const i = this.drawn.length
      const { id, reversed } = this.pending[i]
      this.drawn.push({ cardId: id, reversed, positionKey: this.spread.positions[i].key })
      if (this.drawn.length === this.cardCount) this.phase = 'revealing'
    },

    revealCard(positionKey) {
      this._assert('revealing', 'revealCard')
      if (!this.drawn.some((d) => d.positionKey === positionKey)) {
        throw new Error(`[reading] 未知位置：${positionKey}`)
      }
      if (this.revealedKeys.includes(positionKey)) {
        throw new Error(`[reading] 位置 ${positionKey} 已翻开`)
      }
      this.revealedKeys.push(positionKey)
      this.persistNow()
    },

    revealAll() {
      this._assert('revealing', 'revealAll')
      this.revealedKeys = this.drawn.map((d) => d.positionKey)
      this.persistNow()
    },

    goInterpret() {
      this._assert('revealing', 'goInterpret')
      if (this.revealedCount !== this.cardCount) {
        throw new Error(`[reading] 还有 ${this.cardCount - this.revealedCount} 张未翻开`)
      }
      this.phase = 'interpreting'
      this.persistNow()
    },

    reset() {
      Object.assign(this, initialState())
      clearFlow()
    },

    // 记录动线入口页（仅新局捕获：恢复中的局已有持久化值，不覆盖）
    setEntryPath(path) {
      if (!path || this.entryPath) return
      this.entryPath = path
      this.persistNow()
    },

    persistNow() {
      const { phase, spreadId, question, domain, pending, pickedIndices, drawn, revealedKeys, snapshot, journalId, isDaily, freeMode, freePositions, entryPath } = this
      saveFlow({ phase, spreadId, question, domain, pending, pickedIndices, drawn, revealedKeys: [...revealedKeys], snapshot, journalId, isDaily, freeMode, freePositions: freePositions.map((p) => ({ ...p })), entryPath })
    },

    // 误刷新恢复：路由守卫在进入 /reading/* 前调用；恢复失败则重定向首页
    tryRestore() {
      const saved = loadFlow()
      if (!saved || !PHASES.includes(saved.phase) || saved.phase === 'idle') {
        return false
      }
      // 自由摆放局自包含（位置随 flow 持久化）；注册表局要求牌阵仍存在（含自定义被删 -> 恢复失败回首页）
      const spreadOk =
        saved.freeMode && saved.spreadId === 'free'
          ? Array.isArray(saved.freePositions) && saved.freePositions.length > 0
          : !!findSpread(saved.spreadId)
      if (!spreadOk) return false
      Object.assign(this, { ...initialState(), ...saved })
      return true
    },

    // 返回手势（UX #8 / Task 15）：占卜动线内逐级回退；questioning 再退则退出本局
    stepBack() {
      const order = ['questioning', 'shuffling', 'picking', 'revealing', 'interpreting']
      const idx = order.indexOf(this.phase)
      if (idx <= 0) {
        this.reset()
        return null
      }
      const prev = order[idx - 1]
      if (prev === 'shuffling' || prev === 'picking') {
        // 退回洗牌/抽牌都会重抽：已落库的记录与本局永久不一致（旧牌面存库、
        // 新牌面展示/AI/分享），必须删除旧记录（连带 dailyDraws 引用）并失效 journalId
        if (this.journalId) {
          deleteReading(this.journalId)
          this.journalId = null
        }
      }
      if (prev === 'shuffling') {
        // 退回洗牌：清空已抽/待抽（finishShuffle 会重建牌池）
        this.drawn = []
        this.pending = []
        this.pickedIndices = []
        this.revealedKeys = []
      } else if (prev === 'picking') {
        // 退回抽牌：重建牌池（用户见过翻开的牌再回来，理应重新随机，不能保序复用旧池）
        this.pending = drawCards(DECK_IDS, this.cardCount, {
          allowReversed: this.snapshot?.reversalsEnabled ?? false
        })
        this.drawn = []
        this.pickedIndices = []
        this.revealedKeys = []
      } else if (prev === 'revealing') {
        this.revealedKeys = []
      }
      this.phase = prev
      this.persistNow()
      return prev
    },

    hasActiveReading() {
      return this.phase !== 'idle' || this.tryRestore()
    }
  }
})
