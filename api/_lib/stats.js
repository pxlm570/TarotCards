// 站长数据看板的纯聚合（2026-09-26）：只读现有表做统计，不新增收集口径。
// 上海日键贯穿用量与活跃统计，与 AI 额度口径保持一致；成本单位 micro_yuan
// 在此统一换算成元，且只统计成功调用（与额度「失败不占额」互为镜像）。

const MICRO_YUAN_PER_CNY = 1_000_000
const DAY_MS = 24 * 60 * 60 * 1000
const SHANGHAI_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
})

export function dayKeyOf(iso) {
  try {
    return SHANGHAI_DAY.format(new Date(iso))
  } catch {
    return ''
  }
}

export function buildDaySeries(n, todayKey) {
  const end = new Date(`${todayKey}T00:00:00Z`).getTime()
  const series = []
  for (let i = n - 1; i >= 0; i--) {
    series.push({ day: new Date(end - i * DAY_MS).toISOString().slice(0, 10), aiCalls: 0, dau: 0 })
  }
  return series
}

function isCounted(state) {
  // 与额度预留同口径：pending+succeeded 占当日次数，failed 不计
  return state === 'pending' || state === 'succeeded'
}

export function aggregateAiUsage(rows, todayKey, dayKeys) {
  const daySet = new Set(dayKeys)
  const perDay = Object.fromEntries(dayKeys.map((d) => [d, 0]))
  const users = new Map()
  const todayUsers = new Set()
  let callsToday = 0
  let costMicro = 0

  for (const row of rows || []) {
    if (!isCounted(row.state)) continue
    const day = row.used_on
    if (daySet.has(day)) perDay[day] = (perDay[day] || 0) + 1
    if (day === todayKey) {
      callsToday++
      todayUsers.add(row.user_id)
    }
    const entry = users.get(row.user_id) || { user_id: row.user_id, standard: 0, deep: 0, total: 0, costCny: 0 }
    if (row.mode === 'deep') entry.deep++
    else entry.standard++
    entry.total++
    if (row.state === 'succeeded') {
      const cost = Number(row.actual_cost_micro_yuan ?? row.reserved_cost_micro_yuan ?? 0)
      if (Number.isFinite(cost) && cost > 0) {
        costMicro += cost
        entry.costCny += cost / MICRO_YUAN_PER_CNY
      }
    }
    users.set(row.user_id, entry)
  }

  return {
    callsToday,
    usersToday: todayUsers.size,
    perDay,
    perUser: [...users.values()],
    costCnyTotal: costMicro / MICRO_YUAN_PER_CNY
  }
}

export function aggregateActivity(rows, todayKey, dayKeys) {
  const daySet = new Set(dayKeys)
  const perDayUsers = new Map(dayKeys.map((d) => [d, new Set()]))
  const featureCounts = new Map()

  for (const row of rows || []) {
    const day = dayKeyOf(row.created_at)
    if (daySet.has(day)) {
      if (!perDayUsers.has(day)) perDayUsers.set(day, new Set())
      perDayUsers.get(day).add(row.user_id)
    }
    // page_view 只用于日活，不进「功能使用」榜
    if (row.name && row.name !== 'page_view') {
      featureCounts.set(row.name, (featureCounts.get(row.name) || 0) + 1)
    }
  }

  const perDay = Object.fromEntries([...perDayUsers.entries()].map(([d, set]) => [d, set.size]))
  const features = [...featureCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  return { perDay, dauToday: perDay[todayKey] || 0, features }
}

// 邀请码明文不可恢复（库内只有哈希），看板只露前 8 位作标识
export function summarizeInvites(invites, emailById, now) {
  const nowMs = new Date(now || 0).getTime()
  return (invites || []).map((row) => {
    const status = row.redeemed_by
      ? 'redeemed'
      : new Date(row.expires_at).getTime() > nowMs
        ? 'available'
        : 'expired'
    return {
      tail: String(row.code_hash || '').slice(0, 8),
      status,
      redeemedEmail: (row.redeemed_by && emailById.get(row.redeemed_by)) || '',
      createdAt: row.created_at,
      expiresAt: row.expires_at
    }
  })
}
