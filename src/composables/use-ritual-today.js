// 仪式牌阵判定（Task 21 抽出，首页/选牌阵页共用）：
// 新月/满月当天（moon-phases 双源核实数据）或生日窗口（前 3 后 3 天）命中 -> 返回仪式牌阵 id
import { computed } from 'vue'
import spreads from '../data/spreads.json'
import moonPhases from '../data/moon-phases.json'
import { useProfileStore } from '../stores/profile.js'
import { currentDayKey } from '../lib/day-key.js'

const DAY_MS = 86400000

/**
 * 生日窗口：生日 ±3 天。
 * 生日只有「月-日」有意义——必须归一到今天所在年份再比，直接拿出生年份相减差值恒为几千天。
 * 取 去年/今年/明年 三个候选的最小天差，跨年边界（12-30 生日在次年 1-2 号）自然覆盖。
 * 用 Date.UTC 做纯日期算术，避开夏令时导致的 ±1 小时取整偏差。
 * @param {string} birthday YYYY-MM-DD
 * @param {string} dayKey   今天的打卡日 key（凌晨 4 点为界），默认取当前
 */
export function isBirthdayWindow(birthday, dayKey = currentDayKey()) {
  if (typeof birthday !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false
  const [, bm, bd] = birthday.split('-').map(Number)
  const [ty, tm, td] = dayKey.split('-').map(Number)
  const today = Date.UTC(ty, tm - 1, td)
  // 2-29 生日在平年由 Date 自动归到 3-1，不抛错
  return [ty - 1, ty, ty + 1].some(
    (y) => Math.abs(Math.round((today - Date.UTC(y, bm - 1, bd)) / DAY_MS)) <= 3
  )
}

/** @param {string} [dayKey] 覆盖「今天」，仅测试用；生产不传 */
export function useRitualToday(dayKey) {
  const profile = useProfileStore()

  const today = computed(() => dayKey ?? currentDayKey())

  const ritualToday = computed(() => {
    const day = today.value
    if (moonPhases.newMoon.includes(day)) return 'new-moon'
    if (moonPhases.fullMoon.includes(day)) return 'full-moon'
    if (isBirthdayWindow(profile.birthday, day)) return 'birthday'
    return null
  })

  // 命中的仪式牌阵本体：首页提示行与选牌阵页「今日限定」置顶节都取它
  const ritualSpread = computed(() => spreads.find((s) => s.id === ritualToday.value) ?? null)

  return { ritualToday, ritualSpread, spreads }
}
