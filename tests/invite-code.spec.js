// 邀请码格式（2026-09-28 用户拍板改六位字母数字）：31 字符集去混淆（无 I/L/O 与 0/1），
// 微信手输不混码；一次性 + 限时 + 兑换需登录，对熟人内测防爆破足够（31^6≈8.9 亿）。
// 旧版 24 位虚线十六进制码的存量可兑性由候选双形态保证。
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import {
  INVITE_CODE_ALPHABET,
  generateInviteCode,
  normalizeInviteCode,
  inviteCodeCandidates,
  inviteCodeHash
} from '../api/_lib/invite-code.js'

describe('邀请码格式', () => {
  it('生成码为 6 位，且每个字符都来自去混淆字母表', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateInviteCode()
      expect(code).toMatch(/^[A-Z0-9]{6}$/)
      for (const ch of code) expect(INVITE_CODE_ALPHABET).toContain(ch)
    }
  })

  it('字母表含字母与数字，且不含易混淆的 I/L/O/0/1', () => {
    expect(INVITE_CODE_ALPHABET).toMatch(/[A-Z]/)
    expect(INVITE_CODE_ALPHABET).toMatch(/[2-9]/)
    expect(INVITE_CODE_ALPHABET).not.toMatch(/[ILO01]/)
  })

  it('归一化：去空格与横线、转大写、空输入得空串', () => {
    expect(normalizeInviteCode(' k7q4xb ')).toBe('K7Q4XB')
    expect(normalizeInviteCode('AB12-CD34-EF56')).toBe('AB12CD34EF56')
    expect(normalizeInviteCode('  ')).toBe('')
    expect(normalizeInviteCode(null)).toBe('')
  })

  it('候选形态：新码单候选；旧 24 位十六进制码附带旧虚线格式', () => {
    expect(inviteCodeCandidates('k7q4xb')).toEqual(['K7Q4XB'])
    expect(inviteCodeCandidates('ab12-cd34-ef56-7890-1234-5678')).toEqual([
      'AB12CD34EF56789012345678',
      'AB12-CD34-EF56-7890-1234-5678'
    ])
  })

  it('哈希与旧实现一致（sha256 hex）', () => {
    expect(inviteCodeHash('K7Q4XB')).toBe(createHash('sha256').update('K7Q4XB').digest('hex'))
  })
})
