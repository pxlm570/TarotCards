// storage 写失败告警（评审 2026-09-06）：配额满时 safeSetItem/saveSettings 曾静默失败，
// UI 照常报「已保存」——用户刷新即丢数据且无线索。告警经 setStorageWarnHandler 注入
// （避免 storage→feedback 循环依赖），15s 节流防批量写刷屏。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { safeParse, safeGetItem, safeRemoveItem, safeKeys, safeSetItem, saveSettings, setStorageWarnHandler, FLOW_KEY, loadFlow, saveFlow, clearFlow } from '../src/lib/storage.js'

describe('storage：写失败告警', () => {
  afterEach(() => {
    setStorageWarnHandler(null)
    vi.restoreAllMocks()
    vi.useRealTimers()
    localStorage.clear()
  })

  it('配额写失败触发告警回调，15s 节流内不重复', () => {
    const warn = vi.fn()
    setStorageWarnHandler(warn)
    vi.useFakeTimers()
    vi.setSystemTime(0)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    expect(safeSetItem('tarot.test.v1', '1')).toBe(false)
    expect(safeSetItem('tarot.test.v1', '2')).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)

    vi.setSystemTime(16000)
    expect(safeSetItem('tarot.test.v1', '3')).toBe(false)
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('saveSettings 写失败同样告警', () => {
    const warn = vi.fn()
    setStorageWarnHandler(warn)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })
    saveSettings({ theme: 'dark' })
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('写成功不触发告警；未注册回调时静默不崩', () => {
    const warn = vi.fn()
    setStorageWarnHandler(warn)
    expect(safeSetItem('tarot.test.v1', '1')).toBe(true)
    expect(warn).not.toHaveBeenCalled()

    setStorageWarnHandler(null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })
    expect(() => safeSetItem('tarot.test.v1', '2')).not.toThrow()
  })
})

// 防御助手：journal-store/backup 等存储层共用的容错路径，假值/坏 JSON/裸 localStorage 抛错一律静默降级
describe('storage：防御助手', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('safeParse：假值与坏 JSON 返回 null，合法 JSON 正常解析', () => {
    expect(safeParse('')).toBeNull()
    expect(safeParse(null)).toBeNull()
    expect(safeParse(undefined)).toBeNull()
    expect(safeParse(0)).toBeNull()
    expect(safeParse('{oops')).toBeNull()
    expect(safeParse('{"a":1}')).toEqual({ a: 1 })
    expect(safeParse('[1,2]')).toEqual([1, 2])
  })

  it('safeGetItem：正常取值、缺失键为 null；getItem 抛 SecurityError 回落 null', () => {
    localStorage.setItem('tarot.test.v1', 'abc')
    expect(safeGetItem('tarot.test.v1')).toBe('abc')
    expect(safeGetItem('tarot.missing.v1')).toBeNull()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(safeGetItem('tarot.test.v1')).toBeNull()
  })

  it('safeRemoveItem：正常返回 true 并真删；removeItem 抛错返回 false', () => {
    localStorage.setItem('tarot.test.v1', '1')
    expect(safeRemoveItem('tarot.test.v1')).toBe(true)
    expect(localStorage.getItem('tarot.test.v1')).toBeNull()
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(safeRemoveItem('tarot.test.v1')).toBe(false)
  })

  it('safeKeys：正常返回已存键；键枚举抛错回落空数组', () => {
    localStorage.setItem('tarot.test.a.v1', '1')
    localStorage.setItem('tarot.test.b.v1', '2')
    expect(safeKeys()).toEqual(expect.arrayContaining(['tarot.test.a.v1', 'tarot.test.b.v1']))
    // Proxy ownKeys 陷阱抛错模拟「localStorage 被禁用」时 Object.keys 直接炸的场景
    const hostile = new Proxy({}, { ownKeys() { throw new DOMException('blocked', 'SecurityError') } })
    vi.stubGlobal('localStorage', hostile)
    expect(safeKeys()).toEqual([])
  })
})

// flow 动线状态（sessionStorage）：读写容错与旧键清理契约。会话级存储与 localStorage
// 同属 Storage.prototype，抛错模拟沿用本文件既有的 prototype spy 手法。
describe('storage：flow 读写与清理', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('saveFlow 写入 sessionStorage，loadFlow 读回同一对象', () => {
    const flow = { phase: 'picking', spreadId: 'three-cards', entryPath: '/' }
    saveFlow(flow)
    expect(sessionStorage.getItem(FLOW_KEY)).toBe(JSON.stringify(flow))
    expect(loadFlow()).toEqual(flow)
  })

  it('坏 JSON 与键缺失 → loadFlow 返回 null', () => {
    sessionStorage.setItem(FLOW_KEY, '{oops')
    expect(loadFlow()).toBeNull()
    sessionStorage.removeItem(FLOW_KEY)
    expect(loadFlow()).toBeNull()
  })

  it('getItem 抛 SecurityError（iOS 阻 Cookie 同族）→ loadFlow 返回 null', () => {
    sessionStorage.setItem(FLOW_KEY, JSON.stringify({ phase: 'picking' }))
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(loadFlow()).toBeNull()
  })

  it('setItem 抛 QuotaExceeded → saveFlow 静默不炸', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })
    expect(() => saveFlow({ phase: 'picking' })).not.toThrow()
  })

  it('clearFlow 同时清 FLOW_KEY 与旧版 practice-pending 键', () => {
    sessionStorage.setItem(FLOW_KEY, JSON.stringify({ phase: 'picking' }))
    sessionStorage.setItem('tarot.practice-pending.v1', JSON.stringify({ practiceTask: 'x' }))
    clearFlow()
    expect(sessionStorage.getItem(FLOW_KEY)).toBeNull()
    expect(sessionStorage.getItem('tarot.practice-pending.v1')).toBeNull()
  })
})
