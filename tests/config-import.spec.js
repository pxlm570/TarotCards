// #import= 配置分享链接的两段式导入（评审 2026-09-03）：链接不再静默写入设置——
// 先解析暂存，跳设置页由用户确认应用。此前任何人可伪造链接静默替换 AI 端点，
// 用户后续占卜提问会流向第三方服务器且毫无察觉。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { parseImportHash, stashPendingImport, takePendingImport, discardPendingImport, IMPORT_PENDING_KEY } from '../src/lib/config-import.js'

function b64(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
}

describe('config-import：#import= 两段式', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('合法链接解析出归一化配置（缺省字段补空串）', () => {
    const cfg = parseImportHash(`#import=${b64({ baseUrl: 'https://api.x.com', model: 'm1' })}`)
    // 只收下实际存在的字段（评审 2026-09-06）：缺席字段不再以 '' 应用，防抹掉现有配置
    expect(cfg).toEqual({ baseUrl: 'https://api.x.com', model: 'm1' })
  })

  it('缺失字段不产生空串键（apiKey-only / model 缺席各自保留缺席语义）', () => {
    expect(parseImportHash(`#import=${b64({ apiKey: 'k' })}`)).toEqual({ apiKey: 'k' })
    expect(parseImportHash(`#import=${b64({ baseUrl: 'https://a.b', model: '', apiKey: 'k' })}`)).toEqual({
      baseUrl: 'https://a.b',
      apiKey: 'k'
    })
  })

  it('非 #import= 前缀 / 坏 base64 / 无任何配置字段 -> null', () => {
    expect(parseImportHash('#/deck')).toBe(null)
    expect(parseImportHash('#import=!!!not-base64!!!')).toBe(null)
    expect(parseImportHash(`#import=${b64({ foo: 1 })}`)).toBe(null)
  })

  it('stash/take 往返；take 即取即清（不留第二次确认的残影）', () => {
    const cfg = { baseUrl: 'https://a.b', model: 'm', apiKey: 'k' }
    stashPendingImport(cfg)
    expect(takePendingImport()).toEqual(cfg)
    expect(sessionStorage.getItem(IMPORT_PENDING_KEY)).toBeNull()
    expect(takePendingImport()).toBe(null)
  })

  it('discard 清除暂存；坏 JSON 的暂存取用返回 null', () => {
    stashPendingImport({ baseUrl: 'x' })
    discardPendingImport()
    expect(takePendingImport()).toBe(null)

    sessionStorage.setItem(IMPORT_PENDING_KEY, '{broken')
    expect(takePendingImport()).toBe(null)
    expect(sessionStorage.getItem(IMPORT_PENDING_KEY)).toBeNull()
  })

  it('非字符串字段值不收下：类型不符的键被剔除，全不合法整体 -> null', () => {
    // baseUrl:123 在「有无配置字段」预检里是真值，但收字段时按类型过滤
    expect(parseImportHash(`#import=${b64({ baseUrl: 123, model: true })}`)).toBe(null)
  })

  it('JSON null / 数组载荷不是配置对象 -> null', () => {
    expect(parseImportHash(`#import=${b64(null)}`)).toBe(null)
    expect(parseImportHash(`#import=${b64([1, 2])}`)).toBe(null)
  })

  it('中文等非 ASCII 字段值经 escape/unescape 往返不乱码', () => {
    const cfg = parseImportHash(`#import=${b64({ baseUrl: 'https://a.b', model: '星语-中转' })}`)
    expect(cfg).toEqual({ baseUrl: 'https://a.b', model: '星语-中转' })
  })

  it('暂存取用：非对象 JSON（数字）与坏 JSON 一样返回 null 且清键', () => {
    sessionStorage.setItem(IMPORT_PENDING_KEY, '123')
    expect(takePendingImport()).toBe(null)
    expect(sessionStorage.getItem(IMPORT_PENDING_KEY)).toBeNull()
  })

  it('sessionStorage 被禁（抛异常）时安全降级：暂存不炸、取用回落 null', () => {
    const throwing = {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('SecurityError') },
      removeItem: () => { throw new Error('SecurityError') }
    }
    vi.stubGlobal('sessionStorage', throwing)
    expect(() => stashPendingImport({ baseUrl: 'x' })).not.toThrow()
    expect(takePendingImport()).toBe(null)
    expect(() => discardPendingImport()).not.toThrow()
  })
})
