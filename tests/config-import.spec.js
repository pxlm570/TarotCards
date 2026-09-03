// #import= 配置分享链接的两段式导入（评审 2026-09-03）：链接不再静默写入设置——
// 先解析暂存，跳设置页由用户确认应用。此前任何人可伪造链接静默替换 AI 端点，
// 用户后续占卜提问会流向第三方服务器且毫无察觉。
import { describe, it, expect, beforeEach } from 'vitest'
import { parseImportHash, stashPendingImport, takePendingImport, discardPendingImport, IMPORT_PENDING_KEY } from '../src/lib/config-import.js'

function b64(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
}

describe('config-import：#import= 两段式', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('合法链接解析出归一化配置（缺省字段补空串）', () => {
    const cfg = parseImportHash(`#import=${b64({ baseUrl: 'https://api.x.com', model: 'm1' })}`)
    expect(cfg).toEqual({ baseUrl: 'https://api.x.com', model: 'm1', apiKey: '' })
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
})
