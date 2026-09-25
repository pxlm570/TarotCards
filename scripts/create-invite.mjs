import { createHash, randomBytes } from 'node:crypto'

const baseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!baseUrl || !serviceKey) {
  console.error('请先设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。')
  process.exit(1)
}

const daysArg = process.argv.find((arg) => arg.startsWith('--days='))
const days = daysArg ? Number(daysArg.slice('--days='.length)) : 14
if (!Number.isInteger(days) || days < 1 || days > 90) {
  console.error('有效期请设为 1 到 90 天，例如：npm run invite:create -- --days=14')
  process.exit(1)
}

const code = randomBytes(12).toString('hex').toUpperCase().match(/.{1,4}/g).join('-')
const codeHash = createHash('sha256').update(code).digest('hex')
const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/rest/v1/beta_invite_codes`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal'
  },
  body: JSON.stringify({ code_hash: codeHash, expires_at: expiresAt })
})
if (!response.ok) {
  console.error(`邀请码创建失败（HTTP ${response.status}）。`)
  process.exit(1)
}
console.log(`邀请码（${days} 天内有效、只能兑换一次）：\n${code}`)
