// 响应式「今天」（Task 1）：跨凌晨 4 点自动换日。
// 此前 ritual 提示的 dayKey 是无依赖 computed（currentDayKey() 只求值一次），
// 应用挂着过夜「今日限定」不换日、重进页面才恢复。
// 共享单例 + 引用计数：首个消费者武装换日定时器（到点刷新后续约次日），
// 最后一个卸载时清理定时器与监听；visibilitychange 回前台立即重算（设备休眠可能错过到点）。
import { ref, onScopeDispose } from 'vue'
import { currentDayKey } from '../lib/day-key.js'

const dayKey = ref(currentDayKey())
let consumers = 0
let timer = null

function refresh() {
  const next = currentDayKey()
  if (next !== dayKey.value) dayKey.value = next
}

function msUntilNext4am(now = new Date()) {
  const next = new Date(now)
  next.setHours(4, 0, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

function arm() {
  if (timer != null) clearTimeout(timer)
  // 定时可能因休眠/后台节流晚触发--refresh 按真实时钟重算，晚到也不错日期
  timer = setTimeout(() => {
    refresh()
    arm()
  }, msUntilNext4am())
}

function onVisible() {
  if (document.visibilityState === 'visible') {
    refresh()
    arm()
  }
}

export function useDayKey() {
  if (consumers === 0) {
    refresh()
    arm()
    document.addEventListener('visibilitychange', onVisible)
  }
  consumers++
  onScopeDispose(() => {
    consumers--
    if (consumers === 0) {
      if (timer != null) {
        clearTimeout(timer)
        timer = null
      }
      document.removeEventListener('visibilitychange', onVisible)
    }
  })
  return dayKey
}
