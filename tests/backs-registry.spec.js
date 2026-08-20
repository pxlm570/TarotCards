// 牌背注册表契约（2026-08-20 用户反馈：致敬夜之城/绚烂霓虹皮肤的牌背在牌背选择里看不到）。
// 根因：牌背选择与收藏馆牌背墙只读 public/backs/index.json，皮肤包自带的 back.webp
// 若不注册进来就是死资产。守卫两条：结构完整、已上线皮肤（除遗留白名单）的牌背必须可选。
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import backs from '../public/backs/index.json'
import deckIds from '../public/decks/index.json'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// rws/rws-sepia 是牌背机制上线前的遗留皮肤，其牌面定位为经典复刻，牌背沿用通用款
const LEGACY_DECKS = new Set(['rws', 'rws-sepia'])

describe('backs/index.json 牌背注册表', () => {
  it('条目字段完整且 id 唯一', () => {
    const ids = new Set()
    for (const b of backs) {
      expect(b.id, JSON.stringify(b)).toBeTruthy()
      expect(b.name, b.id).toBeTruthy()
      expect(b.file, b.id).toMatch(/\.webp$/)
      expect(ids.has(b.id), `重复 id：${b.id}`).toBe(false)
      ids.add(b.id)
    }
  })

  it('引用的图片文件都存在于 public/backs/', () => {
    for (const b of backs) {
      const p = resolve(ROOT, 'public/backs', b.file)
      expect(existsSync(p), `缺少文件：${b.file}`).toBe(true)
    }
  })

  it('非遗留皮肤的牌背均已注册（防孤儿牌背）', () => {
    const backIds = new Set(backs.map((b) => b.id))
    for (const id of deckIds) {
      if (LEGACY_DECKS.has(id)) continue
      expect(backIds.has(id), `皮肤 ${id} 的牌背未注册进 backs/index.json`).toBe(true)
    }
  })
})
