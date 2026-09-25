// 站长 GUI 生成邀请码（2026-09-25，与 npm run invite:create 同规则）：
// 一人一码、只显示一次、库内只存 SHA-256，有效期 1–90 天默认 14。
// 门禁见 _lib/owner.js——只有 ADMIN_EMAIL 的会话能调。
import { createHash, randomBytes } from 'node:crypto'
import { readJson, sendJson } from '../_lib/http.js'
import { requireOwner } from '../_lib/owner.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: '仅支持 POST' })
  try {
    const access = await requireOwner(req)
    if (access.status) return sendJson(res, access.status, { error: access.error })

    const body = await readJson(req, 2048).catch(() => ({}))
    let days = Number(body?.days ?? 14)
    if (!Number.isInteger(days) || days < 1 || days > 90) days = 14

    const code = randomBytes(12).toString('hex').toUpperCase().match(/.{1,4}/g).join('-')
    const codeHash = createHash('sha256').update(code).digest('hex')
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await access.client
      .from('beta_invite_codes')
      .insert({ code_hash: codeHash, expires_at: expiresAt })
    if (error) return sendJson(res, 503, { error: '邀请码创建失败' })
    return sendJson(res, 200, { code, days })
  } catch (error) {
    return sendJson(res, error.statusCode || 503, {
      error: error.statusCode ? error.message : '邀请码服务暂不可用'
    })
  }
}
