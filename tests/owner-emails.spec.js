// 站长白名单（2026-09-29 用户拍板按白名单做）：ADMIN_EMAILS 支持逗号/分号/空白
// 分隔多个邮箱，与旧 ADMIN_EMAIL 单值并集兼容；都未配置=管理面禁用。
// 归一化：trim + 小写 + 去重——邮箱比较不区分大小写。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ownerEmails } from '../api/_lib/owner.js'

describe('ownerEmails：站长白名单解析', () => {
  const ENV = (extra) => ({ ...extra })

  beforeEach(() => {})
  afterEach(() => {})

  it('ADMIN_EMAILS 逗号/分号/空白分隔，归一化去重', () => {
    expect(ownerEmails(ENV({ ADMIN_EMAILS: 'A@X.com, b@x.com；C@X.com  d@x.com,,A@x.com' }))).toEqual([
      'a@x.com', 'b@x.com', 'c@x.com', 'd@x.com'
    ])
  })

  it('旧 ADMIN_EMAIL 单值仍生效（向后兼容）', () => {
    expect(ownerEmails(ENV({ ADMIN_EMAIL: ' Owner@X.com ' }))).toEqual(['owner@x.com'])
  })

  it('两者同时配置取并集', () => {
    expect(ownerEmails(ENV({ ADMIN_EMAIL: 'a@x.com', ADMIN_EMAILS: 'b@x.com, a@x.com' }))).toEqual([
      'a@x.com', 'b@x.com'
    ])
  })

  it('都未配置或全空白 = 空清单（管理面禁用）', () => {
    expect(ownerEmails(ENV({}))).toEqual([])
    expect(ownerEmails(ENV({ ADMIN_EMAILS: ' , ; ' }))).toEqual([])
    expect(ownerEmails(ENV({ ADMIN_EMAIL: '', ADMIN_EMAILS: '' }))).toEqual([])
  })
})
