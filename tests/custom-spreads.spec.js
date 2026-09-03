// 自定义牌阵数据层（v1.5 Task 5）：CRUD + 校验 + 容量上限，key tarot.custom-spreads.v1。
// id 强制 custom- 前缀防与静态 spreads.json 撞车；位置 key 统一 p1..pN（保存时归一）。
import { describe, it, expect, beforeEach } from 'vitest'
import {
  listCustomSpreads,
  getCustomSpread,
  saveCustomSpread,
  deleteCustomSpread,
  MAX_CUSTOM_SPREADS,
  CUSTOM_SPREADS_KEY
} from '../src/lib/custom-spreads.js'

const okPositions = [
  { label: '过去', x: 20, y: 40 },
  { label: '未来', x: 80, y: 40 }
]

describe('custom-spreads', () => {
  beforeEach(() => localStorage.clear())

  it('保存与读取：id 前缀 custom-、cardCount 派生、位置 key 自动归一', () => {
    const saved = saveCustomSpread({ name: '我的两张', positions: okPositions })
    expect(saved.id.startsWith('custom-')).toBe(true)
    expect(saved.cardCount).toBe(2)
    expect(saved.positions.map((p) => p.key)).toEqual(['p1', 'p2'])
    expect(saved.positions[0].meaning).toBe('') // meaning 可省略，归一为空串
    expect(listCustomSpreads()).toHaveLength(1)
    expect(getCustomSpread(saved.id).name).toBe('我的两张')
    expect(getCustomSpread('single')).toBe(null) // 静态 id 不在本库
  })

  // ---- 稳定位置 key（评审 2026-09-03）：key 跟随牌位身份，编辑删位不重排，
  // 历史记录的 positionKey 永不悬空/错位 ----
  it('稳定 key：编辑删中间位，幸存行 key 不重排', () => {
    const created = saveCustomSpread({
      name: '三阵',
      positions: [
        { key: 'p1', label: '一', x: 10, y: 10 },
        { key: 'p2', label: '二', x: 50, y: 50 },
        { key: 'p3', label: '三', x: 90, y: 90 }
      ]
    })
    saveCustomSpread({
      id: created.id,
      name: '三阵',
      positions: [
        { key: 'p1', label: '一', x: 10, y: 10 },
        { key: 'p3', label: '三', x: 90, y: 90 }
      ]
    })
    const after = getCustomSpread(created.id)
    expect(after.positions.map((p) => p.key)).toEqual(['p1', 'p3'])
    expect(after.cardCount).toBe(2)
  })

  it('稳定 key：新增行顺位取最大编号 +1（p1,p3 存在 -> 新行 p4）', () => {
    const created = saveCustomSpread({
      name: '稀疏',
      positions: [
        { key: 'p1', label: '一', x: 10, y: 10 },
        { key: 'p3', label: '三', x: 90, y: 90 }
      ]
    })
    const updated = saveCustomSpread({
      id: created.id,
      name: '稀疏',
      positions: [
        { key: 'p1', label: '一', x: 10, y: 10 },
        { key: 'p3', label: '三', x: 90, y: 90 },
        { label: '新位', x: 50, y: 50 }
      ]
    })
    expect(updated.positions.map((p) => p.key)).toEqual(['p1', 'p3', 'p4'])
  })

  it('稳定 key：重复 key 与非法 key 格式均拒绝', () => {
    expect(() =>
      saveCustomSpread({
        name: '重键',
        positions: [
          { key: 'p2', label: 'a', x: 10, y: 10 },
          { key: 'p2', label: 'b', x: 20, y: 20 }
        ]
      })
    ).toThrow()
    expect(() =>
      saveCustomSpread({ name: '坏键', positions: [{ key: 'pos1', label: 'a', x: 10, y: 10 }] })
    ).toThrow()
  })

  it('向后兼容：不带 key 的行仍顺位补号 p1..pN（自由摆放/旧调用方不受影响）', () => {
    const s = saveCustomSpread({
      name: '旧式',
      positions: [
        { label: 'a', x: 10, y: 10 },
        { label: 'b', x: 50, y: 50 }
      ]
    })
    expect(s.positions.map((p) => p.key)).toEqual(['p1', 'p2'])
  })

  it('更新：带 id 保存覆盖原条目且 id 不变，createdAt 不被刷新', () => {
    const saved = saveCustomSpread({ name: '草稿', positions: okPositions })
    const updated = saveCustomSpread({ id: saved.id, name: '定稿', positions: okPositions })
    expect(updated.id).toBe(saved.id)
    expect(updated.createdAt).toBe(saved.createdAt)
    expect(listCustomSpreads()).toHaveLength(1)
    expect(listCustomSpreads()[0].name).toBe('定稿')
  })

  it('更新不存在的 custom id 抛错（防误造幽灵条目）', () => {
    expect(() => saveCustomSpread({ id: 'custom-ghost', name: 'x', positions: okPositions })).toThrow()
  })

  it('删除：删对返回真，删空返回假', () => {
    const saved = saveCustomSpread({ name: 'x', positions: okPositions })
    expect(deleteCustomSpread(saved.id)).toBe(true)
    expect(listCustomSpreads()).toHaveLength(0)
    expect(deleteCustomSpread(saved.id)).toBe(false)
  })

  it('校验：名称空/超 12 字、0/11 张位、label 空、坐标越界、非数字坐标均抛错', () => {
    expect(() => saveCustomSpread({ name: '  ', positions: okPositions })).toThrow()
    expect(() => saveCustomSpread({ name: 'x'.repeat(13), positions: okPositions })).toThrow()
    expect(() => saveCustomSpread({ name: 'x', positions: [] })).toThrow()
    expect(() => saveCustomSpread({ name: 'x', positions: Array.from({ length: 11 }, (_, i) => ({ label: `位${i}`, x: 50, y: 50 })) })).toThrow()
    expect(() => saveCustomSpread({ name: 'x', positions: [{ label: ' ', x: 50, y: 50 }] })).toThrow()
    expect(() => saveCustomSpread({ name: 'x', positions: [{ label: '位', x: 101, y: 50 }] })).toThrow()
    expect(() => saveCustomSpread({ name: 'x', positions: [{ label: '位', x: '50', y: 50 }] })).toThrow()
  })

  it('id 防线：静态 id 与非 custom- 前缀 id 都拒绝', () => {
    expect(() => saveCustomSpread({ id: 'single', name: 'x', positions: okPositions })).toThrow()
    expect(() => saveCustomSpread({ id: 'my-spread', name: 'x', positions: okPositions })).toThrow()
  })

  it(`上限 ${MAX_CUSTOM_SPREADS} 个：第 ${MAX_CUSTOM_SPREADS + 1} 个抛错`, () => {
    for (let i = 0; i < MAX_CUSTOM_SPREADS; i++) {
      saveCustomSpread({ name: `阵${i}`, positions: okPositions })
    }
    expect(() => saveCustomSpread({ name: '超了', positions: okPositions })).toThrow()
  })

  it('容错：损坏 JSON 视为空库，不抛错', () => {
    localStorage.setItem(CUSTOM_SPREADS_KEY, '{oops')
    expect(listCustomSpreads()).toEqual([])
    const saved = saveCustomSpread({ name: '重建', positions: okPositions })
    expect(getCustomSpread(saved.id).name).toBe('重建')
  })
})
