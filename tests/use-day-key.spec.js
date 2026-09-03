// 响应式日键（Task 1）：跨凌晨 4 点自动换日。
// 此前 ritual 提示的 dayKey 是无依赖 computed，应用挂着过夜「今日限定」不换日。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectScope } from 'vue'

describe('useDayKey：跨凌晨 4 点换日', () => {
  let scope
  let useDayKey

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-17T03:00:00')) // 4 点界前，属 08-16
    // 单例模块状态（dayKey ref / consumers 引用计数）在 isolate:false 下随 worker 跨文件共享：
    // 其它文件的测试若泄漏消费者，静态导入会拿到被污染的单例（home-topbar.spec 未卸载曾致 CI 全红）。
    // 每例重置模块后动态导入，拿到全新单例，时序上已在假时钟之后，初始值即假时间。
    vi.resetModules()
    ;({ useDayKey } = await import('../src/composables/use-day-key.js'))
    scope = effectScope()
  })

  afterEach(() => {
    scope.stop() // 清空消费者，定时器随之 disarm，不泄漏到后续用例
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('初始值等于当前打卡日 key（03:00 属前一天）', () => {
    let key
    scope.run(() => {
      key = useDayKey()
    })
    expect(key.value).toBe('2026-08-16')
  })

  it('到 4 点自动换日：定时器到点后翻页并续约次日', () => {
    let key
    scope.run(() => {
      key = useDayKey()
    })
    vi.advanceTimersByTime(60 * 60 * 1000 + 1000) // 推到 04:00:01
    expect(key.value).toBe('2026-08-17')
    expect(vi.getTimerCount()).toBe(1) // 已续约次日的定时器
  })

  it('回前台重算：设备休眠错过到点，visibilitychange 兜底', () => {
    let key
    scope.run(() => {
      key = useDayKey()
    })
    // 模拟休眠：系统时间已翻页，但定时器未触发（setSystemTime 不触发定时器）
    vi.setSystemTime(new Date('2026-08-18T12:00:00'))
    expect(key.value).toBe('2026-08-16') // 仍是旧值
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(key.value).toBe('2026-08-18')
  })

  it('最后一个消费者卸载后清理定时器与监听', () => {
    expect(vi.getTimerCount()).toBe(0)
    const scopeA = effectScope()
    scopeA.run(() => useDayKey())
    expect(vi.getTimerCount()).toBe(1)
    const scopeB = effectScope()
    scopeB.run(() => useDayKey())
    expect(vi.getTimerCount()).toBe(1) // 共享单例，不重复武装
    scopeA.stop()
    expect(vi.getTimerCount()).toBe(1) // 还有消费者
    scopeB.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})
