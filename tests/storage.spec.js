// storage 写失败告警（评审 2026-09-06）：配额满时 safeSetItem/saveSettings 曾静默失败，
// UI 照常报「已保存」——用户刷新即丢数据且无线索。告警经 setStorageWarnHandler 注入
// （避免 storage→feedback 循环依赖），15s 节流防批量写刷屏。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { safeSetItem, saveSettings, setStorageWarnHandler } from '../src/lib/storage.js'

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
