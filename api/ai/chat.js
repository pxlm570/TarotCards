import { randomUUID } from 'node:crypto'
import { bearerToken, readJson, sendJson } from '../_lib/http.js'
import { getAuthorizedUser } from '../_lib/supabase.js'
import { loadAiConfig, resolveAiConfig } from '../_lib/ai-config.js'

const MAX_MESSAGES = 24
const MAX_TOTAL_CHARS = 24000

function shanghaiDayAndMonth() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).map((part) => [part.type, part.value]))
  return { day: `${parts.year}-${parts.month}-${parts.day}`, month: `${parts.year}-${parts.month}-01` }
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) return false
  let totalChars = 0
  for (const message of messages) {
    if (!message || !['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return false
    if (message.content.length > 12000) return false
    totalChars += message.content.length
    if (totalChars > MAX_TOTAL_CHARS) return false
  }
  return messages.some((message) => message.role === 'user')
}

// 仅用于提交调用前的预算预留；成功后以供应商返回的 token usage 结算。
function estimateInputTokens(messages) {
  const text = messages.map((message) => message.content).join('\n')
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length
  const other = text.length - cjk
  return Math.ceil((cjk + other / 3) * 1.2)
}

function estimateMicroYuan(ai, messages) {
  const inputTokens = estimateInputTokens(messages)
  return Math.ceil(inputTokens * ai.priceIn + ai.maxTokens * ai.priceOut)
}

function usageMicroYuan(ai, usage) {
  const prompt = Number(usage?.prompt_tokens)
  const completion = Number(usage?.completion_tokens)
  if (!Number.isFinite(prompt) || !Number.isFinite(completion)) return null
  return Math.ceil(prompt * ai.priceIn + completion * ai.priceOut)
}

function writeSseError(res, message) {
  res.write(`data: ${JSON.stringify({ error: { message, type: 'server_error' } })}\n\n`)
  res.write('data: [DONE]\n\n')
}

async function settle(client, requestId, ai, usage, succeeded, estimatedCost) {
  // 若上游断流/客户端中止且没有返回 usage，也按预留上限计入月预算，
  // 避免通过反复中止请求让已发生的部分调用成本绕过预算上限。
  const actualCost = usageMicroYuan(ai, usage) ?? estimatedCost
  const { error } = await client.rpc('settle_ai_request', {
    p_request_id: requestId,
    p_actual_cost_micro_yuan: actualCost,
    p_succeeded: succeeded
  })
  if (error) console.error('AI usage settlement failed', requestId)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: '仅支持 POST' })
  let access
  let reserved = false
  let requestId = ''
  let mode = 'standard'
  let estimatedCost = 0
  let ai = null
  let usage = null
  let completed = false
  let providerFailed = false
  let disconnected = false
  const controller = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) {
      disconnected = true
      controller.abort()
    }
  })

  try {
    access = await getAuthorizedUser(bearerToken(req))
    if (!access.user) return sendJson(res, access.status, { error: access.error })
    const body = await readJson(req)
    mode = body.mode === 'deep' ? 'deep' : body.mode === 'standard' ? 'standard' : ''
    if (!mode || !validateMessages(body.messages)) return sendJson(res, 400, { error: '请求内容无效' })

    // 统一 LLM 配置只存 Supabase app_config 表；读取失败/未配置都不外呼，直接拒服。
    try {
      ai = resolveAiConfig(await loadAiConfig(), mode)
    } catch {
      ai = { error: 'not_configured' }
    }
    if (ai.error) return sendJson(res, 503, { error: '默认 AI 暂未启用' })

    requestId = randomUUID()
    const { day, month } = shanghaiDayAndMonth()
    estimatedCost = estimateMicroYuan(ai, body.messages)
    // 按人按天限额（普通/深度各自计数），用量成本仅记录不拦截
    const { data: reservation, error: reservationError } = await access.client.rpc('reserve_ai_request', {
      p_user_id: access.user.id,
      p_request_id: requestId,
      p_day: day,
      p_month: month,
      p_mode: mode,
      p_standard_limit: ai.dailyStandardLimit,
      p_deep_limit: ai.dailyDeepLimit,
      p_reserved_cost_micro_yuan: estimatedCost
    })
    if (reservationError) throw new Error('AI 额度服务暂不可用')
    if (!reservation?.reserved) {
      if (reservation?.reason === 'daily_limit') {
        return sendJson(res, 429, {
          error:
            mode === 'deep'
              ? '今天的深度解读次数已用完，请明天再来。'
              : '今天的 AI 解读次数已用完，请明天再来。'
        })
      }
      return sendJson(res, 429, { error: '今天的 AI 体验资格校验未通过，请稍后再试。' })
    }
    reserved = true

    const upstream = await fetch(`${ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ai.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: ai.model,
        messages: body.messages,
        stream: true,
        max_tokens: ai.maxTokens
      }),
      signal: controller.signal
    })
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel().catch(() => {})
      await settle(access.client, requestId, ai, null, false, estimatedCost)
      reserved = false
      return sendJson(res, 502, { error: '默认 AI 暂时无法响应，请稍后重试。' })
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
    const decoder = new TextDecoder()
    let buffer = ''
    for await (const chunk of upstream.body) {
      if (disconnected) break
      const text = decoder.decode(chunk, { stream: true })
      buffer += text
      let boundary
      let outgoing = ''
      while ((boundary = buffer.indexOf('\n')) !== -1) {
        const rawLine = buffer.slice(0, boundary)
        const line = rawLine.trim()
        buffer = buffer.slice(boundary + 1)
        if (!line.startsWith('data:')) {
          outgoing += `${rawLine}\n`
          continue
        }
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') {
          completed = !providerFailed
          outgoing += `${rawLine}\n`
          continue
        }
        try {
          const packet = JSON.parse(payload)
          if (packet.usage) usage = packet.usage
          if (packet.error) {
            providerFailed = true
            packet.error = { type: 'server_error', message: 'AI 服务暂时不可用，请稍后重试。' }
          }
          // 统一品牌文案；模型标识留在服务端，不随 SSE 返回给浏览器。
          delete packet.model
          outgoing += `data: ${JSON.stringify(packet)}\n`
        } catch {
          outgoing += `${rawLine}\n`
        }
      }
      if (outgoing) res.write(outgoing)
    }
    if (buffer && !disconnected) {
      const line = buffer.trim()
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') completed = !providerFailed
        else {
          try {
            const packet = JSON.parse(payload)
            if (packet.usage) usage = packet.usage
            if (packet.error) {
              providerFailed = true
              packet.error = { type: 'server_error', message: 'AI 服务暂时不可用，请稍后重试。' }
            }
            delete packet.model
            res.write(`data: ${JSON.stringify(packet)}\n\n`)
          } catch {
            res.write(`${buffer}\n`)
          }
        }
      } else res.write(`${buffer}\n`)
    }
    if (!disconnected && !completed) writeSseError(res, 'AI 响应中断，请重试。')
    if (!res.writableEnded) res.end()
    await settle(access.client, requestId, ai, usage, completed && !disconnected, estimatedCost)
    reserved = false
  } catch (error) {
    if (reserved && access?.client) {
      await settle(access.client, requestId, ai, usage, false, estimatedCost).catch(() => {})
      reserved = false
    }
    if (disconnected || controller.signal.aborted) return
    if (res.headersSent) {
      writeSseError(res, 'AI 服务暂时不可用，请稍后重试。')
      return res.end()
    }
    return sendJson(res, error.statusCode || 503, {
      error: error.statusCode ? error.message : 'AI 服务暂时不可用，请稍后重试。'
    })
  }
}
