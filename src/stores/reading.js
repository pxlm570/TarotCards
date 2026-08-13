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
import { loadSettings, loadFlow, saveFlow, clearFlow, DOMAIN_VALUES } from '../lib/storage.js'

const DECK_IDS = cardsData.map((c) => c.id)
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
    revealedKeys: [], // 实际翻开的 positionKey（保序）——只存计数会让刷新恢复错位
    snapshot: null, // finishShuffle 时的设置快照 { reversalsEnabled, autoDraw }
    journalId: null, // M3：本局已写入记录库的 reading id（随 flow 持久化，一局只存一次）
    isDaily: false // M3：每日一抽局（?daily=1），落库时打卡
  }
}

export const useReadingStore = defineStore('reading', {
  state: initialState,

  getters: {
    spread: (s) => spreadsData.find((sp) => sp.id === s.spreadId) ?? null,
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
      if (!spreadsData.some((sp) => sp.id === spreadId)) {
        throw new Error(`[reading] 未知牌阵：${spreadId}`)
      }
      this.spreadId = spreadId
      this.phase = 'spreadSelected'
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

    persistNow() {
      const { phase, spreadId, question, domain, pending, pickedIndices, drawn, revealedKeys, snapshot, journalId, isDaily } = this
      saveFlow({ phase, spreadId, question, domain, pending, pickedIndices, drawn, revealedKeys: [...revealedKeys], snapshot, journalId, isDaily })
    },

    // 误刷新恢复：路由守卫在进入 /reading/* 前调用；恢复失败则重定向首页
    tryRestore() {
      const saved = loadFlow()
      if (
        !saved ||
        !PHASES.includes(saved.phase) ||
        saved.phase === 'idle' ||
        !spreadsData.some((sp) => sp.id === saved.spreadId)
      ) {
        return false
      }
      Object.assign(this, { ...initialState(), ...saved })
      return true
    },

    // 返回手势（UX #8）：占卜动线内逐级回退；questioning 再退则退出本局
    stepBack() {
      const order = ['questioning', 'shuffling', 'picking', 'revealing', 'interpreting']
      const idx = order.indexOf(this.phase)
      if (idx <= 0) {
        this.reset()
        return null
      }
      const prev = order[idx - 1]
      // 回退时清掉只会向前的中间态，避免回到旧步骤后状态错位
      if (prev === 'picking') {
        this.drawn = []
        this.pending = []
        this.pickedIndices = []
      }
      if (prev === 'revealing') {
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
