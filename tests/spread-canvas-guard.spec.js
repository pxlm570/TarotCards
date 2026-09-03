// SpreadCanvas 悬空 positionKey 兜底（评审 2026-09-03）：牌阵编辑删位后历史记录的
// key 对不上，画布须跳过该牌渲染而不是对 undefined 取坐标崩页。
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SpreadCanvas from '../src/components/SpreadCanvas.vue'

vi.mock('../src/lib/use-deck.js', () => ({
  useDeck: () => ({ manifest: {}, cardUrl: () => '', backUrl: () => '', error: null, retry: () => {} })
}))

const SPREAD = {
  id: 'test',
  positions: [
    { key: 'p1', label: '一', x: 20, y: 30 },
    { key: 'p2', label: '二', x: 60, y: 30 }
  ]
}

function mountCanvas(cards) {
  return mount(SpreadCanvas, {
    props: { spread: SPREAD, cards, revealed: null, readonly: true }
  })
}

describe('SpreadCanvas：悬空 positionKey 兜底', () => {
  it('positionKey 能对上的牌正常渲染', () => {
    const w = mountCanvas([{ cardId: 'major-00', reversed: false, positionKey: 'p1' }])
    expect(w.findAll('.slot')).toHaveLength(1)
  })

  it('悬空 key 的牌被跳过，不抛 TypeError、其余牌照常渲染', () => {
    const w = mountCanvas([
      { cardId: 'major-00', reversed: false, positionKey: 'p1' },
      { cardId: 'major-01', reversed: true, positionKey: 'ghost' } // 牌阵编辑删位后悬空
    ])
    expect(w.findAll('.slot')).toHaveLength(1)
  })

  it('全部悬空时不渲染任何牌位且不崩', () => {
    const w = mountCanvas([{ cardId: 'major-07', reversed: false, positionKey: 'gone' }])
    expect(w.findAll('.slot')).toHaveLength(0)
  })
})
