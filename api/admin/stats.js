// 站长数据看板端点（2026-09-26）：成员/邀请码/AI 用量与成本/活跃度一屏总览。
// 只读现有表做聚合（_lib/stats.js 纯函数），服务端 owner 门禁，普通成员 403。
import { sendJson } from '../_lib/http.js'
import { requireOwner } from '../_lib/owner.js'
import {
  dayKeyOf,
  buildDaySeries,
  aggregateAiUsage,
  aggregateActivity,
  summarizeInvites
} from '../_lib/stats.js'

const DAY_MS = 24 * 60 * 60 * 1000

function countTodayByUser(rows, today) {
  const counts = new Map()
  for (const row of rows || []) {
    if (row.used_on !== today || (row.state !== 'pending' && row.state !== 'succeeded')) continue
    const entry = counts.get(row.user_id) || { standard: 0, deep: 0 }
    if (row.mode === 'deep') entry.deep++
    else entry.standard++
    counts.set(row.user_id, entry)
  }
  return counts
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: '仅支持 GET' })
  try {
    const access = await requireOwner(req)
    if (access.status) return sendJson(res, access.status, { error: access.error })
    const client = access.client

    const today = dayKeyOf(new Date().toISOString())
    const series = buildDaySeries(14, today)
    const dayKeys = series.map((d) => d.day)
    const since30 = dayKeyOf(new Date(Date.now() - 30 * DAY_MS).toISOString())

    const [usersRes, membersRes, invitesRes, usageRes, eventsRes] = await Promise.all([
      client.auth.admin.listUsers({ perPage: 1000 }),
      client.from('beta_members').select('user_id, invite_code_hash, created_at'),
      client
        .from('beta_invite_codes')
        .select('code_hash, redeemed_by, redeemed_at, created_at, expires_at')
        .order('created_at', { ascending: false })
        .limit(500),
      client
        .from('ai_usage_events')
        .select('user_id, mode, state, used_on, actual_cost_micro_yuan, reserved_cost_micro_yuan')
        .gte('used_on', since30),
      client
        .from('app_events')
        .select('user_id, name, created_at')
        .gte('created_at', `${dayKeys[0]}T00:00:00Z`)
    ])
    if (usersRes.error || membersRes.error || invitesRes.error || usageRes.error || eventsRes.error) {
      throw new Error('看板数据读取失败')
    }

    const emailById = new Map((usersRes.data?.users || []).map((u) => [u.id, u.email || '']))
    const usage = aggregateAiUsage(usageRes.data || [], today, dayKeys)
    const activity = aggregateActivity(eventsRes.data || [], today, dayKeys)
    const invites = summarizeInvites(invitesRes.data || [], emailById, new Date().toISOString())

    for (const d of series) {
      d.aiCalls = usage.perDay[d.day] || 0
      d.dau = activity.perDay[d.day] || 0
    }

    const todayCounts = countTodayByUser(usageRes.data || [], today)
    const usageByUser = new Map(usage.perUser.map((u) => [u.user_id, u]))
    const members = (membersRes.data || [])
      .map((m) => {
        const t = todayCounts.get(m.user_id) || { standard: 0, deep: 0 }
        const u = usageByUser.get(m.user_id)
        return {
          email: emailById.get(m.user_id) || '',
          joinedAt: m.created_at,
          todayStandard: t.standard,
          todayDeep: t.deep,
          totalCalls: u ? u.total : 0,
          costCny: u ? Math.round(u.costCny * 10000) / 10000 : 0
        }
      })
      .sort((a, b) => String(b.joinedAt).localeCompare(String(a.joinedAt)))

    return sendJson(res, 200, {
      today,
      totals: {
        members: members.length,
        dauToday: activity.dauToday,
        aiCallsToday: usage.callsToday,
        aiUsersToday: usage.usersToday,
        cost30dCny: usage.costCnyTotal,
        invites: {
          total: invites.length,
          redeemed: invites.filter((i) => i.status === 'redeemed').length,
          available: invites.filter((i) => i.status === 'available').length,
          expired: invites.filter((i) => i.status === 'expired').length
        }
      },
      series,
      features: activity.features,
      members,
      invites
    })
  } catch {
    return sendJson(res, 503, { error: '看板服务暂不可用' })
  }
}
