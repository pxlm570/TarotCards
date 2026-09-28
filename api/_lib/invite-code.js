// 邀请码生成与归一（2026-09-28 用户拍板六位字母数字）：create 接口与 CLI 同规则，
// redeem 兑换前先归一。字符集刻意去掉易混淆的 I/L/O 与 0/1（微信手输不混码），
// 31 字符集 ^ 6 ≈ 8.9 亿组合——一次性 + 限时 + 兑换需登录，熟人内测防爆破足够。
import { createHash, randomInt } from 'node:crypto'

export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const INVITE_CODE_LENGTH = 6

export function generateInviteCode() {
  let code = ''
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)]
  return code
}

export function normalizeInviteCode(input) {
  return String(input ?? '').replace(/[\s-]/g, '').toUpperCase()
}

// 兑换按候选形态逐个试哈希：新码即归一化形态本身；
// 旧版（2026-09-28 前）24 位虚线十六进制码补上带横线的原形态，存量码仍可兑。
export function inviteCodeCandidates(code) {
  const normalized = normalizeInviteCode(code)
  if (!/^[0-9A-F]{24}$/.test(normalized)) return [normalized]
  return [normalized, normalized.match(/.{1,4}/g).join('-')]
}

export function inviteCodeHash(code) {
  return createHash('sha256').update(code).digest('hex')
}
