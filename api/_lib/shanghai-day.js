// 上海自然日键（YYYY-MM-DD，Asia/Shanghai）：AI 额度按上海自然日计（status/chat），
// 看板统计同口径（stats）——三处共用一份实现，防止口径漂移。
const SHANGHAI_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
})

export function shanghaiDayKey(date = new Date()) {
  return SHANGHAI_DAY.format(date)
}

// day 与 month 取自同一时刻：跨月零点拆成两次调用会自相矛盾。
export function shanghaiDayAndMonthKeys(date = new Date()) {
  const parts = Object.fromEntries(SHANGHAI_DAY.formatToParts(date).map((p) => [p.type, p.value]))
  return { day: `${parts.year}-${parts.month}-${parts.day}`, month: `${parts.year}-${parts.month}-01` }
}
