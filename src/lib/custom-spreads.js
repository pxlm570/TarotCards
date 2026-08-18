// 自定义牌阵数据层（v1.5 Task 5）：CRUD + 校验 + 容量上限。
// 存储键 tarot.custom-spreads.v1（走 storage.js safe 封装）；id 强制 custom- 前缀，
// 与静态 spreads.json 的 id 永不撞车；位置 key 统一 p1..pN（保存时归一，编辑器无需关心）。
import { safeGetItem, safeSetItem } from './storage.js'
import spreadsData from '../data/spreads.json'

export const CUSTOM_SPREADS_KEY = 'tarot.custom-spreads.v1'
export const MAX_CUSTOM_SPREADS = 20

const STATIC_IDS = new Set(spreadsData.map((s) => s.id))

function fail(msg) {
  throw new Error(`[custom-spread] ${msg}`)
}

function loadAll() {
  try {
    const parsed = JSON.parse(safeGetItem(CUSTOM_SPREADS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return [] // 损坏数据按空库处理
  }
}

function persist(list) {
  safeSetItem(CUSTOM_SPREADS_KEY, JSON.stringify(list))
}

function normalizePositions(positions) {
  if (!Array.isArray(positions) || positions.length < 1) fail('至少需要 1 个牌位')
  if (positions.length > 10) fail('最多 10 个牌位')
  return positions.map((p, i) => {
    const label = typeof p?.label === 'string' ? p.label.trim() : ''
    if (!label) fail(`第 ${i + 1} 个牌位名称不能为空`)
    const meaning = typeof p.meaning === 'string' ? p.meaning.trim().slice(0, 50) : ''
    if (typeof p.x !== 'number' || typeof p.y !== 'number' || Number.isNaN(p.x) || Number.isNaN(p.y)) {
      fail(`第 ${i + 1} 个牌位坐标必须是数字`)
    }
    if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) fail(`第 ${i + 1} 个牌位坐标须在 0-100`)
    return { key: `p${i + 1}`, label, meaning, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }
  })
}

export function listCustomSpreads() {
  return loadAll()
}

export function getCustomSpread(id) {
  return loadAll().find((s) => s.id === id) ?? null
}

export function saveCustomSpread({ id, name, positions }) {
  const cleanName = typeof name === 'string' ? name.trim() : ''
  if (!cleanName) fail('名称不能为空')
  if (cleanName.length > 12) fail('名称最多 12 个字')
  const cleanPositions = normalizePositions(positions)

  const list = loadAll()
  const now = Date.now()

  if (id !== undefined) {
    if (typeof id !== 'string' || !id.startsWith('custom-') || STATIC_IDS.has(id)) fail('非法 id')
    const idx = list.findIndex((s) => s.id === id)
    if (idx === -1) fail('要更新的牌阵不存在')
    const updated = { ...list[idx], name: cleanName, positions: cleanPositions, cardCount: cleanPositions.length, updatedAt: now }
    list[idx] = updated
    persist(list)
    return updated
  }

  if (list.length >= MAX_CUSTOM_SPREADS) fail(`最多保存 ${MAX_CUSTOM_SPREADS} 个自定义牌阵，请先删掉不用的`)
  // 时间戳 + 随机尾巴：同毫秒连建两个也不撞
  const newId = `custom-${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`
  const created = { id: newId, name: cleanName, positions: cleanPositions, cardCount: cleanPositions.length, createdAt: now, updatedAt: now }
  list.push(created)
  persist(list)
  return created
}

export function deleteCustomSpread(id) {
  const list = loadAll()
  const next = list.filter((s) => s.id !== id)
  if (next.length === list.length) return false
  persist(next)
  return true
}
