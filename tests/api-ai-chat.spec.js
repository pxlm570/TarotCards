// /api/ai/chat handler：统一 LLM 代理的核心链路——入参校验（mode/messages 规则与
// 边界）、配置缺失 503 拒服、按人按天预留（上海日/月键 + 估算成本公式）、上游
// SSE 中继（model 剥除/error 包改写/非 data 行透传/跨 chunk 拆包/尾包兜底）、
// 断流与客户端中止的结算口径（p_succeeded=false、无 usage 回落预留上限）。
// Supabase（getAuthorizedUser/rpc）与上游 fetch 全 mock，不联网。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  access: null, // getAuthorizedUser 返回值
  configDoc: null, // loadAiConfig 返回的文档
  configError: null, // loadAiConfig 抛错
  upstream: null // 上游 fetch 响应
}))

vi.mock('../api/_lib/supabase.js', () => ({
  getServiceClient: vi.fn(),
  getAuthorizedUser: vi.fn(async () => state.access)
}))

vi.mock('../api/_lib/ai-config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  // resolveAiConfig 用真实实现；读配置按 state 分流（不触发 60s 进程内缓存）
  loadAiConfig: vi.fn(async () => {
    if (state.configError) throw state.configError
    return state.configDoc
  })
}))

const CONFIG = {
  base_url: 'https://llm.example/v1',
  api_key: 'sk-owner-key',
  model_standard: 'std-model',
  model_deep: 'deep-model',
  max_tokens_standard: 1200,
  max_tokens_deep: 3000,
  price_standard_in: 2,
  price_standard_out: 8,
  price_deep_in: 2,
  price_deep_out: 8,
  daily_standard_limit: 5,
  daily_deep_limit: 1
}

// rpc 按 name 分发：reserve 默认放行，settle 恒成功；调用全记录供断言
function memberClient({ reserve = { reserved: true }, reserveError = null, settleError = null } = {}) {
  const calls = []
  return {
    calls,
    rpc: vi.fn(async (name, args) => {
      calls.push({ name, args })
      if (name === 'reserve_ai_request') {
        return reserveError ? { data: null, error: reserveError } : { data: reserve, error: null }
      }
      return settleError ? { data: null, error: settleError } : { data: null, error: null }
    })
  }
}

function mockRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    writes: [],
    closeHandlers: [],
    headersSent: false,
    writableEnded: false,
    setHeader(name, value) {
      this.headers[name] = value
    },
    on(event, fn) {
      if (event === 'close') this.closeHandlers.push(fn)
    },
    flushHeaders() {
      this.headersSent = true
    },
    write(chunk) {
      this.headersSent = true
      this.writes.push(String(chunk))
      return true
    },
    end(payload) {
      this.writableEnded = true
      if (payload !== undefined) this.body = String(payload)
    }
  }
  res.simulateClose = () => res.closeHandlers.forEach((fn) => fn())
  return res
}

function reqOf(method, body) {
  const req = { method, headers: { authorization: 'Bearer tok' } }
  if (body !== undefined) {
    req[Symbol.asyncIterator] = async function* () {
      yield Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
    }
  }
  return req
}

function sse(chunks, { ok = true, status = 200 } = {}) {
  const encoder = new TextEncoder()
  return {
    ok,
    status,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      }
    })
  }
}

let fetchMock

async function freshHandler() {
  vi.resetModules()
  return (await import('../api/ai/chat.js')).default
}

const USER_MSG = { role: 'user', content: '你好' }

beforeEach(() => {
  state.access = { user: { id: 'u1', email: 'm@x.com' }, client: memberClient() }
  state.configDoc = { ...CONFIG }
  state.configError = null
  state.upstream = sse(['data: [DONE]\n\n'])
  fetchMock = vi.fn(async () => state.upstream)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('/api/ai/chat：方法与鉴权', () => {
  it('GET → 405 仅支持 POST', async () => {
    const res = mockRes()
    await (await freshHandler())(reqOf('GET'), res)
    expect(res.statusCode).toBe(405)
    expect(JSON.parse(res.body)).toEqual({ error: '仅支持 POST' })
  })

  it('未登录 → 401 透传，不读配置不外呼', async () => {
    state.access = { user: null, status: 401, error: '请先登录' }
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { messages: [USER_MSG] }), res)
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body)).toEqual({ error: '请先登录' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(state.access.client?.calls ?? []).toHaveLength(0)
  })
})

describe('/api/ai/chat：入参校验', () => {
  it('mode 缺失或未知（含大小写不归一）→ 400 请求内容无效', async () => {
    const handler = await freshHandler()
    for (const body of [{ messages: [USER_MSG] }, { mode: 'DEEP', messages: [USER_MSG] }, { mode: 'free', messages: [USER_MSG] }]) {
      const res = mockRes()
      await handler(reqOf('POST', body), res)
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body)).toEqual({ error: '请求内容无效' })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('messages 结构非法（空数组/缺 user/坏 role/非字符串 content/messages 非数组）→ 400', async () => {
    const handler = await freshHandler()
    const badBodies = [
      { mode: 'standard' },
      { mode: 'standard', messages: [] },
      { mode: 'standard', messages: [{ role: 'assistant', content: '只有助手' }] },
      { mode: 'standard', messages: [{ role: 'tool', content: 'x' }, USER_MSG] },
      { mode: 'standard', messages: [{ role: 'user', content: 42 }] },
      { mode: 'standard', messages: 'not-array' }
    ]
    for (const body of badBodies) {
      const res = mockRes()
      await handler(reqOf('POST', body), res)
      expect(res.statusCode).toBe(400, JSON.stringify(body))
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('条数边界：24 条（MAX）通过校验进入预留，25 条拒绝', async () => {
    const handler = await freshHandler()
    state.access.client = memberClient({ reserve: { reserved: false, reason: 'daily_limit' } })

    const ok24 = mockRes()
    await handler(reqOf('POST', { mode: 'standard', messages: Array.from({ length: 24 }, () => ({ ...USER_MSG })) }), ok24)
    expect(ok24.statusCode).toBe(429) // 已走到预留分支 = 校验通过
    expect(state.access.client.calls).toHaveLength(1)

    state.access.client = memberClient({ reserve: { reserved: false, reason: 'daily_limit' } })
    const bad25 = mockRes()
    await handler(reqOf('POST', { mode: 'standard', messages: Array.from({ length: 25 }, () => ({ ...USER_MSG })) }), bad25)
    expect(bad25.statusCode).toBe(400)
    expect(state.access.client.calls).toHaveLength(0)
  })

  it('单条长度边界：12000 字符通过，12001 拒绝', async () => {
    const handler = await freshHandler()
    state.access.client = memberClient({ reserve: { reserved: false, reason: 'daily_limit' } })

    const ok = mockRes()
    await handler(reqOf('POST', { mode: 'standard', messages: [{ role: 'user', content: 'x'.repeat(12000) }] }), ok)
    expect(ok.statusCode).toBe(429)

    state.access.client = memberClient({ reserve: { reserved: false, reason: 'daily_limit' } })
    const bad = mockRes()
    await handler(reqOf('POST', { mode: 'standard', messages: [{ role: 'user', content: 'x'.repeat(12001) }] }), bad)
    expect(bad.statusCode).toBe(400)
  })

  it('总长度边界：合计 24000 通过，24001 拒绝', async () => {
    const handler = await freshHandler()
    state.access.client = memberClient({ reserve: { reserved: false, reason: 'daily_limit' } })

    const ok = mockRes()
    await handler(
      reqOf('POST', { mode: 'standard', messages: [0, 1, 2].map(() => ({ role: 'user', content: 'x'.repeat(8000) })) }),
      ok
    )
    expect(ok.statusCode).toBe(429)

    state.access.client = memberClient({ reserve: { reserved: false, reason: 'daily_limit' } })
    const bad = mockRes()
    await handler(
      reqOf('POST', {
        mode: 'standard',
        messages: [{ role: 'user', content: 'x'.repeat(8001) }, { role: 'user', content: 'x'.repeat(8000) }, { role: 'user', content: 'x'.repeat(8000) }]
      }),
      bad
    )
    expect(bad.statusCode).toBe(400)
  })
})

describe('/api/ai/chat：配置与预留', () => {
  it('配置必需字段不齐 → 503 默认 AI 暂未启用，不预留不外呼', async () => {
    state.configDoc = { base_url: 'https://llm.example/v1' } // 缺 key/模型
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ error: '默认 AI 暂未启用' })
    expect(state.access.client.calls).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loadAiConfig 抛错（读库失败）→ 同样 503 拒服', async () => {
    state.configError = new Error('db down')
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ error: '默认 AI 暂未启用' })
  })

  it('预留 rpc 出错 → 503，未外呼未结算（注意：抛出的「额度服务」文案被兜底 catch 吞掉，实际回落通用文案）', async () => {
    state.access.client = memberClient({ reserveError: { message: 'db down' } })
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ error: 'AI 服务暂时不可用，请稍后重试。' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(state.access.client.calls).toHaveLength(1) // 只有 reserve
  })

  it('daily_limit：普通与深度档文案不同，均 429 且不外呼', async () => {
    const handler = await freshHandler()
    state.access.client = memberClient({ reserve: { reserved: false, reason: 'daily_limit' } })
    const std = mockRes()
    await handler(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), std)
    expect(std.statusCode).toBe(429)
    expect(JSON.parse(std.body)).toEqual({ error: '今天的 AI 解读次数已用完，请明天再来。' })

    state.access.client = memberClient({ reserve: { reserved: false, reason: 'daily_limit' } })
    const deep = mockRes()
    await handler(reqOf('POST', { mode: 'deep', messages: [USER_MSG] }), deep)
    expect(deep.statusCode).toBe(429)
    expect(JSON.parse(deep.body)).toEqual({ error: '今天的深度解读次数已用完，请明天再来。' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reserved:false 且原因未知 → 429 资格校验未通过', async () => {
    state.access.client = memberClient({ reserve: { reserved: false, reason: 'member_revoked' } })
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    expect(res.statusCode).toBe(429)
    expect(JSON.parse(res.body)).toEqual({ error: '今天的 AI 体验资格校验未通过，请稍后再试。' })
  })

  it('预留按上海自然日/月键（UTC 跨日边界）且透传限额与用户', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T18:30:00Z')) // 上海 2026-01-02 02:30
    state.access.client = memberClient({ reserve: { reserved: false, reason: 'daily_limit' } })
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    expect(res.statusCode).toBe(429)
    const args = state.access.client.calls[0].args
    expect(args.p_day).toBe('2026-01-02')
    expect(args.p_month).toBe('2026-01-01')
    expect(args.p_user_id).toBe('u1')
    expect(args.p_mode).toBe('standard')
    expect(args.p_standard_limit).toBe(5)
    expect(args.p_deep_limit).toBe(1)
    // 估算成本公式：CJK 计 1 token/字、其他 3 字符 1 token，再放大 1.2 倍
    // 「你好」= ceil((2 + 0/3) * 1.2) = 3 tokens；3*2 + 1200*8 = 9606 微元
    expect(args.p_reserved_cost_micro_yuan).toBe(9606)
  })
})

describe('/api/ai/chat：上游调用与 SSE 中继', () => {
  it('外呼参数：baseUrl 拼接 /chat/completions、Bearer 站长 Key、档位模型与 max_tokens', async () => {
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://llm.example/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer sk-owner-key')
    const payload = JSON.parse(init.body)
    expect(payload.model).toBe('std-model')
    expect(payload.max_tokens).toBe(1200)
    expect(payload.stream).toBe(true)
    expect(payload.messages).toEqual([USER_MSG])
  })

  it('深度档：model/max_tokens 切换 deep 配置，预留 p_mode=deep', async () => {
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'deep', messages: [USER_MSG] }), res)
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(payload.model).toBe('deep-model')
    expect(payload.max_tokens).toBe(3000)
    expect(state.access.client.calls[0].args.p_mode).toBe('deep')
  })

  it('上游非 2xx → 502 默认 AI 暂时无法响应，并按预留上限结算失败', async () => {
    state.upstream = { ok: false, status: 500, body: undefined }
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    expect(res.statusCode).toBe(502)
    expect(JSON.parse(res.body)).toEqual({ error: '默认 AI 暂时无法响应，请稍后重试。' })
    const settle = state.access.client.calls.find((c) => c.name === 'settle_ai_request')
    expect(settle.args.p_succeeded).toBe(false)
    // 无 usage → 回落预留估算（「你好」= 9606）
    expect(settle.args.p_actual_cost_micro_yuan).toBe(9606)
  })

  it('fetch 网络异常 → 503，预留已占用故先结算失败再拒服', async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error('network unreachable')
    })
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ error: 'AI 服务暂时不可用，请稍后重试。' })
    const settle = state.access.client.calls.find((c) => c.name === 'settle_ai_request')
    expect(settle.args.p_succeeded).toBe(false)
  })

  it('正常流：model 剥除、非 data 行/注释行原样透传、usage 捕获、按真实 usage 结算', async () => {
    state.upstream = sse([
      'data: {"model":"secret-model","choices":[{"delta":{"content":"你好"}}]}\n\n',
      ': keep-alive\nevent: message\n',
      'data: {"usage":{"prompt_tokens":10,"completion_tokens":5}}\n',
      'data: [DONE]\n\n'
    ])
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toBe('text/event-stream; charset=utf-8')
    expect(res.headers['X-Accel-Buffering']).toBe('no')
    const text = res.writes.join('')
    expect(text).toContain('data: {"choices":[{"delta":{"content":"你好"}}]}')
    expect(text).not.toContain('secret-model') // 模型标识不随 SSE 出服务端
    expect(text).toContain(': keep-alive\nevent: message\n')
    expect(text).toContain('[DONE]')
    const reserve = state.access.client.calls.find((c) => c.name === 'reserve_ai_request')
    const settle = state.access.client.calls.find((c) => c.name === 'settle_ai_request')
    expect(settle.args.p_succeeded).toBe(true)
    expect(settle.args.p_actual_cost_micro_yuan).toBe(60) // ceil(10*2 + 5*8)
    expect(settle.args.p_request_id).toBe(reserve.args.p_request_id)
  })

  it('JSON 跨 chunk 拆分仍能正确解析中继', async () => {
    state.upstream = sse(['data: {"choices":[{"delta":{"con', 'tent":"分块"}}]}\n\ndata: [DONE]\n\n'])
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    const text = res.writes.join('')
    expect(text).toContain('data: {"choices":[{"delta":{"content":"分块"}}]}')
    expect(state.access.client.calls.find((c) => c.name === 'settle_ai_request').args.p_succeeded).toBe(true)
  })

  it('尾包无换行的 data: [DONE]：标记完成但该行不外发（当前行为），结算成功', async () => {
    state.upstream = sse(['data: [DONE]'])
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    expect(res.writes.join('')).not.toContain('[DONE]')
    expect(res.writes.join('')).not.toContain('AI 响应中断')
    expect(state.access.client.calls.find((c) => c.name === 'settle_ai_request').args.p_succeeded).toBe(true)
  })

  it('流中断（无 [DONE]）→ 追加 SSE 错误事件，结算失败并回落预留估算', async () => {
    state.upstream = sse(['data: {"choices":[{"delta":{"content":"半"}}]}\n\n'])
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [{ role: 'user', content: 'hi' }] }), res)
    const text = res.writes.join('')
    expect(text).toContain('AI 响应中断，请重试。')
    const settle = state.access.client.calls.find((c) => c.name === 'settle_ai_request')
    expect(settle.args.p_succeeded).toBe(false)
    // 「hi」估算：ceil((0 + 2/3) * 1.2) = 1 token；1*2 + 1200*8 = 9602
    expect(settle.args.p_actual_cost_micro_yuan).toBe(9602)
  })

  it('上游 error 包 → 改写为通用 server_error 文案（原文不出服务端），结算失败', async () => {
    state.upstream = sse([
      'data: {"error":{"message":"provider internal boom","code":500}}\n\n',
      'data: [DONE]\n\n'
    ])
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    const text = res.writes.join('')
    expect(text).toContain('AI 服务暂时不可用，请稍后重试。')
    expect(text).not.toContain('provider internal boom')
    expect(text).toContain('AI 响应中断，请重试。') // providerFailed → completed=false
    expect(state.access.client.calls.find((c) => c.name === 'settle_ai_request').args.p_succeeded).toBe(false)
  })

  it('data 行非 JSON → 原样透传不炸', async () => {
    state.upstream = sse(['data: not-json\n\n', 'data: [DONE]\n\n'])
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    expect(res.writes.join('')).toContain('data: not-json\n')
    expect(state.access.client.calls.find((c) => c.name === 'settle_ai_request').args.p_succeeded).toBe(true)
  })

  it('客户端中途断开：立即停止中继、不追加中断错误、按失败结算', async () => {
    let release
    const gate = new Promise((resolve) => {
      release = resolve
    })
    const encoder = new TextEncoder()
    state.upstream = {
      ok: true,
      status: 200,
      body: new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"先"}}]}\n\n'))
          await gate
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      })
    }
    const handler = await freshHandler()
    const res = mockRes()
    const pending = handler(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    await vi.waitFor(() => expect(res.writes.join('')).toContain('先'))
    res.simulateClose() // 模拟浏览器在流结束前断开
    release()
    await pending
    const text = res.writes.join('')
    expect(text).not.toContain('[DONE]')
    expect(text).not.toContain('AI 响应中断')
    expect(res.writableEnded).toBe(true)
    expect(state.access.client.calls.find((c) => c.name === 'settle_ai_request').args.p_succeeded).toBe(false)
  })

  it('结算 rpc 出错 → console.error 记录，不影响 200 流式响应', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    state.access.client = memberClient({ settleError: { message: 'db down' } })
    const res = mockRes()
    await (await freshHandler())(reqOf('POST', { mode: 'standard', messages: [USER_MSG] }), res)
    expect(res.statusCode).toBe(200)
    expect(errorSpy).toHaveBeenCalledWith('AI usage settlement failed', expect.any(String))
  })
})
