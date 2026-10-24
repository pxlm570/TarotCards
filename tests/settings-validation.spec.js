// storage.js loadSettings 逐字段校验（评审 2026-09-06 修复项）：存储里的坏值
//（null/类型漂移/枚举外值/旧版本残留）不得覆盖默认值，未知键一律丢弃。
// 端点变更清 key 的行为见 review-boundaries.spec，此处不重复。
import { describe, it, expect, beforeEach } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings } from '../src/lib/storage.js'

const KEY = 'tarot.settings.v1'

function store(raw) {
  localStorage.setItem(KEY, typeof raw === 'string' ? raw : JSON.stringify(raw))
}

beforeEach(() => localStorage.clear())

describe('loadSettings：逐字段坏值回落默认', () => {
  it('枚举类字段：theme/persona/fontSize/aiMode 的枚举外值回落', () => {
    store({ theme: 'blue', persona: 'mysterious', fontSize: 'giant', aiMode: 'auto' })
    const s = loadSettings()
    expect(s.theme).toBe('auto')
    expect(s.persona).toBe('gentle')
    expect(s.fontSize).toBe('standard')
    expect(['default', 'custom']).toContain(s.aiMode) // 回落值随部署环境，但必在枚举内
  })

  it('布尔类字段：非布尔一律回落（haptics 默认开、其余默认关）', () => {
    store({ haptics: 'yes', reversalsEnabled: 1, autoDraw: 'true', sound: null })
    const s = loadSettings()
    expect(s.haptics).toBe(true)
    expect(s.reversalsEnabled).toBe(false)
    expect(s.autoDraw).toBe(false)
    expect(s.sound).toBe(false)
  })

  it('字符串类字段：AI 三件套非字符串清空；deckId/backId 空值回落默认皮肤', () => {
    store({ apiKey: 123, baseUrl: null, model: {}, deckId: '', backId: 42 })
    const s = loadSettings()
    expect(s.apiKey).toBe('')
    expect(s.baseUrl).toBe('')
    expect(s.model).toBe('')
    expect(s.deckId).toBe('rws')
    expect(s.backId).toBe('star-gold')
  })

  it('reducedMotion 只接受 null 或布尔，其他归 null（跟随系统）', () => {
    store({ reducedMotion: 'no' })
    expect(loadSettings().reducedMotion).toBeNull()
    store({ reducedMotion: false })
    expect(loadSettings().reducedMotion).toBe(false)
    store({ reducedMotion: true })
    expect(loadSettings().reducedMotion).toBe(true)
  })

  it('合法值不被误伤：逐字段写入后原样读回', () => {
    store({
      theme: 'dark', persona: 'scholar', fontSize: 'large', haptics: false,
      reversalsEnabled: true, autoDraw: true, sound: true, deckId: 'rws-sepia',
      backId: 'neon', apiKey: 'k', baseUrl: 'https://a.b', model: 'm', reducedMotion: null
    })
    const s = loadSettings()
    expect(s.theme).toBe('dark')
    expect(s.persona).toBe('scholar')
    expect(s.fontSize).toBe('large')
    expect(s.haptics).toBe(false)
    expect(s.reversalsEnabled).toBe(true)
    expect(s.autoDraw).toBe(true)
    expect(s.sound).toBe(true)
    expect(s.deckId).toBe('rws-sepia')
    expect(s.backId).toBe('neon')
    expect(s.apiKey).toBe('k')
  })

  it('未知键丢弃：结果与 DEFAULT_SETTINGS 键集完全一致', () => {
    store({ theme: 'dark', unknownFlag: true, nested: { evil: 1 }, legacyKey: 0 })
    const s = loadSettings()
    expect(Object.keys(s).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort())
    expect(s.theme).toBe('dark') // 已知键仍生效
  })

  it('坏 JSON / 非对象存储 → 全默认', () => {
    store('{broken')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    store('"just a string"')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    store('42')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('空存储 → 全默认', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
