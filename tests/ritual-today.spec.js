// 仪式牌阵判定（Task 21）：生日窗口必须按「当年」归一——原实现拿出生年份直接与今天相减，
// 差值恒为几千天，永远不命中。跨年边界（12-30 生日在次年 1-2 号）也要命中。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { effectScope } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useProfileStore } from '../src/stores/profile.js'
import { isBirthdayWindow, useRitualToday } from '../src/composables/use-ritual-today.js'

describe('isBirthdayWindow：按当年归一的前 3 后 3 天窗口', () => {
  it('生日当天命中（出生年份多久以前都一样）', () => {
    expect(isBirthdayWindow('1990-05-23', '2026-05-23')).toBe(true)
    expect(isBirthdayWindow('2010-05-23', '2026-05-23')).toBe(true)
  })

  it('前 3 天 / 后 3 天命中，第 4 天落空', () => {
    expect(isBirthdayWindow('1990-05-23', '2026-05-20')).toBe(true)
    expect(isBirthdayWindow('1990-05-23', '2026-05-26')).toBe(true)
    expect(isBirthdayWindow('1990-05-23', '2026-05-19')).toBe(false)
    expect(isBirthdayWindow('1990-05-23', '2026-05-27')).toBe(false)
  })

  it('跨年边界：12-30 生日在次年 1-2 号仍命中，1-3 号落空', () => {
    expect(isBirthdayWindow('1990-12-30', '2027-01-02')).toBe(true)
    expect(isBirthdayWindow('1990-12-30', '2027-01-03')).toBe(false)
  })

  it('跨年边界反向：01-01 生日在上一年 12-29 命中，12-28 落空', () => {
    expect(isBirthdayWindow('1990-01-01', '2025-12-29')).toBe(true)
    expect(isBirthdayWindow('1990-01-01', '2025-12-28')).toBe(false)
  })

  it('2-29 生日在平年归到 3-1，不抛错', () => {
    expect(isBirthdayWindow('1992-02-29', '2026-03-01')).toBe(true)
    expect(isBirthdayWindow('1992-02-29', '2026-03-05')).toBe(false)
    // 闰年当天原生路径：以 02-29 为中心的 ±3 窗口
    expect(isBirthdayWindow('1992-02-29', '2028-02-29')).toBe(true)
    expect(isBirthdayWindow('1992-02-29', '2028-03-04')).toBe(false)
  })

  it('未填 / 非法生日一律不命中', () => {
    expect(isBirthdayWindow('', '2026-05-23')).toBe(false)
    expect(isBirthdayWindow(null, '2026-05-23')).toBe(false)
    expect(isBirthdayWindow(undefined, '2026-05-23')).toBe(false)
    expect(isBirthdayWindow('05-23', '2026-05-23')).toBe(false)
  })
})

describe('useRitualToday：今日限定判定与置顶', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('新月当天返回 new-moon 与新月播种牌阵', () => {
    const { ritualToday, ritualSpread } = useRitualToday('2026-08-13')
    expect(ritualToday.value).toBe('new-moon')
    expect(ritualSpread.value.name).toBe('新月播种')
  })

  it('满月当天返回 full-moon', () => {
    expect(useRitualToday('2026-08-28').ritualToday.value).toBe('full-moon')
  })

  it('生日窗口内返回 birthday；与月相撞车时生日优先（2026-08-17 裁决翻转）', () => {
    useProfileStore().setBirthday('1990-08-14')
    expect(useRitualToday('2026-08-15').ritualToday.value).toBe('birthday')
    expect(useRitualToday('2026-08-13').ritualToday.value).toBe('birthday') // 08-13 是新月且在生日窗口内，生日压过月相
  })

  it('平日不命中：首页提示行与置顶节都不出现', () => {
    const { ritualToday, ritualSpread, spreads } = useRitualToday('2026-08-20')
    expect(ritualToday.value).toBe(null)
    expect(ritualSpread.value).toBe(null)
    expect(spreads[0].id).toBe('single') // 牌阵清单本身不被改写
  })

  // v1.5 Task 4：四季节气（seasons.json 为双源核实的北京时间节气日，跨日边界值尤其要守住）
  it('节气当天返回对应牌阵，含三个北京时间跨日边界', () => {
    expect(useRitualToday('2026-03-20').ritualToday.value).toBe('spring-equinox')
    expect(useRitualToday('2026-12-22').ritualToday.value).toBe('winter-solstice') // UTC 12-21 20:50，北京已是 12-22
    expect(useRitualToday('2027-03-21').ritualToday.value).toBe('spring-equinox') // UTC 03-20 20:25，北京 03-21
    expect(useRitualToday('2028-06-21').ritualToday.value).toBe('summer-solstice') // UTC 06-20 20:02，北京 06-21
    expect(useRitualToday('2027-09-23').ritualSpread.value.name).toBe('秋分归仓')
    expect(useRitualToday('2027-09-22').ritualToday.value).toBe(null) // 前一天不命中
  })

  it('优先级：生日 > 四季（四季 > 月相在数据窗口内无自然撞日，以代码次序保证）', () => {
    useProfileStore().setBirthday('1990-03-20')
    expect(useRitualToday('2026-03-20').ritualToday.value).toBe('birthday') // 生日压过春分
    useProfileStore().setBirthday('1990-01-01')
    expect(useRitualToday('2026-03-20').ritualToday.value).toBe('spring-equinox')
  })
})

describe('useRitualToday 生产路径（不传 dayKey）：跨 4 点自动换日（Task 1）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('应用挂着过夜，提示从无到有自动出现', () => {
    vi.useFakeTimers()
    // 直接从换日前 1 分钟起跑（setSystemTime 大跳不触发已武装的定时器，避免依赖跳变语义）
    vi.setSystemTime(new Date('2026-08-13T03:59:00')) // 属 08-12，平日
    const scope = effectScope()
    try {
      const { ritualToday } = scope.run(() => useRitualToday())
      expect(ritualToday.value).toBe(null)
      vi.advanceTimersByTime(2 * 60 * 1000) // 到 04:01，换日定时器触发 -> 08-13 新月
      expect(ritualToday.value).toBe('new-moon')
    } finally {
      scope.stop() // 失败也要回收单例消费者，免得污染同 worker 后续测试文件
      vi.useRealTimers()
    }
  })
})
