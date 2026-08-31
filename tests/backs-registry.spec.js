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

  it('皮肤自带牌背带版本号 v（卡背重绘后换 URL 破 SW 缓存）', () => {
    // 2026-08-31 与 decks manifest v 同机制：曾部署过旧图的牌背（night-mural 八芒星->W4）
    // URL 不变会卡在 CacheFirst 旧缓存 30 天
    for (const id of deckIds) {
      const b = backs.find((x) => x.id === id)
      if (!b || LEGACY_DECKS.has(id)) continue
      expect(b.v, `${id} 牌背条目缺 v`).toMatch(/^[0-9a-f]{8,16}$/)
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
