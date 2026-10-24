// 打卡日 key：以凌晨 4 点为界（睡前场景：00:30 计入前一天）。
// 跨月/跨年由 Date 对象自动处理。

// 纯本地日期格式化（无 -4h 偏移）：streak/ProfileView 等多处共用同一格式
export function formatDayKey(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

export function currentDayKey(now = new Date()) {
  const d = new Date(now)
  d.setHours(d.getHours() - 4)
  return formatDayKey(d)
}
