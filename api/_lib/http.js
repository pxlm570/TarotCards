export function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function bearerToken(req) {
  const header = req.headers.authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1] || ''
}

export async function readJson(req, maxBytes = 96 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) throw Object.assign(new Error('请求内容过大'), { statusCode: 413 })
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('请求格式无效'), { statusCode: 400 })
  }
}
