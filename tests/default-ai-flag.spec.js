// 统一 LLM 部署开关（2026-09-25 用户拍板）：VITE_ALLOW_CUSTOM_AI=false 时所有用户
// 强制走项目提供的默认 AI——设置里残留的 aiMode:'custom' 不再分流到浏览器直连。
// 坑（isolate:false 共享注册表）：全量跑时真实 supabase.js 可能已被同 worker 其他
// 文件导入缓存，静态导入会让 mock 失效；resetModules 不重跑 mock 工厂，快照值会被
// 冻结。双保险 = 工厂用 getter 返回活值 + 每例 resetModules 后动态导入。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const flags = vi.hoisted(() => ({ custom: true, defaultEnabled: true }))

vi.mock('../src/lib/supabase.js', () => ({
  isSupabaseConfigured: true,
  inviteGateRequired: false,
  get defaultAIEnabled() {
    return flags.defaultEnabled
  },
  get customAIAllowed() {
    return flags.custom
  },
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })),
      onAuthStateChange: vi.fn()
    }
  }
}))

async function importFresh() {
  vi.resetModules()
  return {
    streamChat: (await import('../src/lib/ai-client.js')).streamChat,
    useSettingsStore: (await import('../src/stores/settings.js')).useSettingsStore,
    saveSettings: (await import('../src/lib/storage.js')).saveSettings
  }
}

function sseResponse() {
  const encoder = new TextEncoder()
  return {
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(c) {
        c.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"好"}}]}\n\n'))
        c.enqueue(encoder.encode('data: [DONE]\n\n'))
        c.close()
      }
    }),
    text: async () => ''
  }
}

describe('customAIAllowed=false：统一走默认 AI', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    // isolate:false 共享注册表：flags 回默认值，防止同 worker 后续文件被污染
    flags.custom = true
    flags.defaultEnabled = true
  })

  it('ai-client：设置残留 custom 模式时仍 POST /api/ai/chat 默认代理', async () => {
    flags.custom = false
    const { streamChat, saveSettings } = await importFresh()
    saveSettings({ aiMode: 'custom', baseUrl: '', model: '', apiKey: '' })
    const fetchMock = vi.fn(async () => sseResponse())
    vi.stubGlobal('fetch', fetchMock)
    const out = []
    for await (const d of streamChat({ messages: [{ role: 'user', content: 'hi' }] })) out.push(d)
    expect(out.join('')).toBe('好')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/ai/chat')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body).mode).toBe('standard')
  })

  it('ai-client：forceCustom 仍可探测自定义（入口隐藏但生成器语义不变）', async () => {
    flags.custom = false
    const { streamChat, saveSettings } = await importFresh()
    saveSettings({ aiMode: 'custom' })
    await expect(streamChat({ messages: [], forceCustom: true }).next()).rejects.toThrow(
      'AI_NOT_CONFIGURED'
    )
  })

  it('settings.hasAI：开关关闭时按默认 AI 判定，custom 残留不判 false', async () => {
    flags.custom = false
    const { useSettingsStore, saveSettings } = await importFresh()
    saveSettings({ aiMode: 'custom' })
    expect(useSettingsStore().hasAI).toBe(true)
  })

  it('settings.hasAI：开关开启时 custom 模式仍按自定义配置是否齐全判定', async () => {
    flags.custom = true
    const { useSettingsStore, saveSettings } = await importFresh()
    saveSettings({ aiMode: 'custom' })
    const store = useSettingsStore()
    expect(store.hasAI).toBe(false)
    store.update({ baseUrl: 'https://a.b', model: 'm', apiKey: 'k' })
    expect(store.hasAI).toBe(true)
  })
})
