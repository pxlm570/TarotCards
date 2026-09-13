// 牌背注册表契约（2026-08-20 用户反馈：致敬夜之城/绚烂霓虹皮肤的牌背在牌背选择里看不到）。
// 根因：牌背选择与收藏馆牌背墙只读 public/backs/index.json，皮肤包自带的 back.webp
// 若不注册进来就是死资产。守卫两条：结构完整、已上线皮肤（除遗留白名单）的牌背必须可选。
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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

  it('所有条目带内容哈希 v 且与文件实际 md5 一致（重绘即换 URL 破 SW 缓存）', () => {
    // 2026-08-31 同款根因防线（评审 2026-09-06 扩到全部条目）：曾部署过的牌背原地重绘
    // 而 URL 不变，会卡在 CacheFirst 旧缓存 30 天。v=md5(文件)[:12]，与生图脚本 content_v 同式。
    for (const b of backs) {
      expect(b.v, `${b.id} 牌背条目缺 v`).toMatch(/^[0-9a-f]{12}$/)
      const p = resolve(ROOT, 'public/backs', b.file)
      const actual = createHash('md5').update(readFileSync(p)).digest('hex').slice(0, 12)
      expect(b.v, `${b.id} 的 v 与文件内容不符`).toBe(actual)
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
