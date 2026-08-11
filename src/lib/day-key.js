// 打卡日 key：以凌晨 4 点为界（睡前场景：00:30 计入前一天）。
// （now - 4h）的本地日期 YYYY-MM-DD。跨月/跨年由 Date 对象自动处理。
function pad(n) {
  return String(n).padStart(2, '0')
}

export function currentDayKey(now = new Date()) {
  const d = new Date(now)
  d.setHours(d.getHours() - 4)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
