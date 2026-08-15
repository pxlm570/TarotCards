// 仪式牌阵判定（Task 21）：生日窗口必须按「当年」归一——原实现拿出生年份直接与今天相减，
// 差值恒为几千天，永远不命中。跨年边界（12-30 生日在次年 1-2 号）也要命中。
import { describe, it, expect, beforeEach } from 'vitest'
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

  it('生日窗口内返回 birthday；与月相撞车时月相优先', () => {
    useProfileStore().setBirthday('1990-08-14')
    expect(useRitualToday('2026-08-15').ritualToday.value).toBe('birthday')
    expect(useRitualToday('2026-08-13').ritualToday.value).toBe('new-moon')
  })

  it('平日不命中：首页提示行与置顶节都不出现', () => {
    const { ritualToday, ritualSpread, spreads } = useRitualToday('2026-08-20')
    expect(ritualToday.value).toBe(null)
    expect(ritualSpread.value).toBe(null)
    expect(spreads[0].id).toBe('single') // 牌阵清单本身不被改写
  })
})
