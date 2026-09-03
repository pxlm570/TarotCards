// 牌库页牌背/牌面切换列表的展示顺序（2026-09-03 用户拍板）。
// 纯函数：DeckView 渲染前排序，注册表（index.json）存储顺序不动。
import { describe, it, expect } from 'vitest'
import { orderBacks, orderFaces } from '../src/lib/deck-order.js'

describe('deck-order：牌库切换列表展示顺序', () => {
  it('牌背已解锁排前，锁款整体靠右，组内保持注册表序', () => {
    const list = [
      { id: 'a', unlock: 0 },
      { id: 'lock7', unlock: 7 },
      { id: 'b', unlock: 0 },
      { id: 'lock30', unlock: 30 },
      { id: 'c', unlock: 0 }
    ]
    const out = orderBacks(list, (b) => b.unlock > 0)
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c', 'lock7', 'lock30'])
  })

  it('牌面按拍板顺序：经典/复古在前，致敬夜之城第三、夜之城原画第四、绚烂霓虹垫底', () => {
    const list = ['rws', 'rws-sepia', 'neon-glow', 'night-mural', 'cp2077-local'].map((id) => ({ id }))
    expect(orderFaces(list).map((x) => x.id)).toEqual([
      'rws',
      'rws-sepia',
      'night-mural',
      'cp2077-local',
      'neon-glow'
    ])
  })

  it('本地专属皮肤缺失（公开仓环境）时自然跳过', () => {
    const noLocal = ['rws', 'rws-sepia', 'neon-glow', 'night-mural'].map((id) => ({ id }))
    expect(orderFaces(noLocal).map((x) => x.id)).toEqual(['rws', 'rws-sepia', 'night-mural', 'neon-glow'])
  })

  it('未列入的新皮肤插在绚烂霓虹之前，组内保持注册表序', () => {
    const withNew = ['rws', 'new-a', 'rws-sepia', 'neon-glow', 'new-b'].map((id) => ({ id }))
    expect(orderFaces(withNew).map((x) => x.id)).toEqual(['rws', 'rws-sepia', 'new-a', 'new-b', 'neon-glow'])
  })
})
