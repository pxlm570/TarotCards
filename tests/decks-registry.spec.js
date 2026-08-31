// 皮肤注册表契约（2026-08-24 对抗性审查补）：decks/index.json 的每个皮肤必须有
// manifest、78 牌映射与 cards.json 全等、文件在盘、cardsFrom 指向有效且无环。
// 背景：四个皮肤由三个脚本各自手工注册，注册错 id/漏拷 webp 时 CI 依旧全绿，
// 用户翻到缺牌只会得到 cardUrl() 空串静默缺图（与孤儿牌背 bug 同型）。
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import deckIds from '../public/decks/index.json'
import cards from '../src/data/cards.json'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CARD_IDS = new Set(cards.map((c) => c.id))

function loadManifest(id) {
  // 文件缺失时 readFileSync 直接抛错——注册表里的 id 就该有 manifest
  return JSON.parse(readFileSync(resolve(ROOT, 'public/decks', id, 'manifest.json'), 'utf-8'))
}

describe('decks/index.json 皮肤注册表', () => {
  it('至少注册 rws 与回退皮肤存在', () => {
    expect(deckIds).toContain('rws') // use-deck.js 硬编码回退目标
  })

  it('id 唯一', () => {
    expect(new Set(deckIds).size).toBe(deckIds.length)
  })

  for (const id of deckIds) {
    describe(`${id}`, () => {
      const manifest = loadManifest(id)

      it('manifest 存在且 78 牌映射与 cards.json 全等', () => {
        expect(manifest.id).toBe(id)
        expect(Object.keys(manifest.cards).sort()).toEqual([...CARD_IDS].sort())
        expect(manifest.back, 'back 字段指向牌背文件').toBeTruthy()
      })

      it('带内容版本号 v（卡面重绘后换 URL 破 SW 缓存）', () => {
        // 2026-08-31 夜城小牌事件：文件已更新部署，用户仍看旧图 30 天。
        // 机制：manifest.v -> cardImageUrl 拼 ?v= -> CacheFirst 缓存失效。生图脚本 register() 自动写。
        expect(manifest.v, `${id} manifest 缺 v`).toMatch(/^[0-9a-f]{8,16}$/)
      })

      it('映射的牌面文件与牌背文件都存在', () => {
        for (const file of Object.values(manifest.cards)) {
          expect(existsSync(resolve(ROOT, 'public/decks', id, file)), `${id}/${file}`).toBe(true)
        }
        expect(existsSync(resolve(ROOT, 'public/decks', id, manifest.back)), `${id}/${manifest.back}`).toBe(true)
      })

      if (manifest.cardsFrom) {
        it('cardsFrom 指向已注册皮肤', () => {
          expect(deckIds).toContain(manifest.cardsFrom)
        })
      }
    })
  }

  it('cardsFrom 链无环', () => {
    const manifests = Object.fromEntries(deckIds.map((id) => [id, loadManifest(id)]))
    for (const id of deckIds) {
      const seen = new Set([id])
      let cur = manifests[id].cardsFrom
      while (cur) {
        expect(seen.has(cur), `cardsFrom 环：${id} -> ... -> ${cur}`).toBe(false)
        seen.add(cur)
        cur = manifests[cur]?.cardsFrom
      }
    }
  })
})
