import { findAll } from '../db.js'
import { buildScopeFilter } from './scope.js'

const METRICS = ['revenue', 'closings', 'response_time', 'conversion_rate']

function parseDate(date) {
  if (!date) return null
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? null : d
}

function isInRange(iso, startDate, endDate) {
  if (!iso) return false
  const d = parseDate(iso)
  if (!d) return false
  if (startDate && d < startDate) return false
  if (endDate && d >= endDate) return false
  return true
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function pct(numerator, denominator) {
  if (!denominator) return null
  return Math.round((numerator / denominator) * 100)
}

function defaultWindow() {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 30)
  return { start, end }
}

function previousWindow(start, end) {
  const durationMs = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime())
  const prevStart = new Date(start.getTime() - durationMs)
  return { start: prevStart, end: prevEnd }
}

function trendDirection(current, previous, metric) {
  if (current == null || previous == null) return 'flat'
  if (metric === 'response_time') {
    if (current < previous) return 'up'
    if (current > previous) return 'down'
    return 'flat'
  }
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'flat'
}

function medalForRank(rank) {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return null
}

function activeAgentsForAgency(agencyMembers, agents, agencyId) {
  const memberUserIds = new Set(
    agencyMembers
      .filter((row) => row.agency_id === agencyId && row.status === 'active')
      .map((row) => row.user_id || row.agent_id)
      .filter(Boolean),
  )
  return agents.filter((row) => row.agency_id === agencyId || memberUserIds.has(row.id))
}

function computeAgentStats({
  agent,
  agencyId,
  windowStart,
  windowEnd,
  inquiries,
  opportunities,
  properties,
  conversations,
  messagesByConversation,
}) {
  const agentId = agent.id
  const scopedInquiries = inquiries.filter(
    (row) => row.agency_id === agencyId && row.agent_id === agentId && isInRange(row.created_at, windowStart, windowEnd),
  )
  const scopedWon = opportunities.filter(
    (row) =>
      row.agency_id === agencyId &&
      row.agent_id === agentId &&
      row.stage === 'closed_won' &&
      isInRange(row.closed_at || row.updated_at || row.created_at, windowStart, windowEnd),
  )
  const revenue = scopedWon.reduce((sum, row) => sum + (Number(row.deal_value) || 0), 0)
  const closings = scopedWon.length
  const conversionRate = pct(closings, scopedInquiries.length)
  const activeListings = properties.filter(
    (row) => row.agency_id === agencyId && row.agent_id === agentId && (row.status || 'active') === 'active',
  ).length

  const responseTimes = []
  const agentConversations = conversations.filter((row) => row.assigned_agent_id === agentId)
  for (const conversation of agentConversations) {
    if (!isInRange(conversation.created_at, windowStart, windowEnd)) continue
    const thread = (messagesByConversation.get(conversation.id) || []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    let firstInbound = null
    for (const message of thread) {
      if (message.direction === 'inbound') {
        firstInbound = message
        break
      }
    }
    if (!firstInbound) continue
    for (const message of thread) {
      if (message.direction === 'outbound' && new Date(message.created_at) >= new Date(firstInbound.created_at)) {
        const ms = new Date(message.created_at).getTime() - new Date(firstInbound.created_at).getTime()
        if (ms >= 0) responseTimes.push(ms)
        break
      }
    }
  }

  const medianResponseMinutes =
    responseTimes.length ? Math.round(median(responseTimes) / 60000) : null

  return {
    agent_id: agentId,
    agent_name: agent.name || agent.email || agentId,
    role: agent.role || null,
    revenue,
    closings,
    conversion_rate: conversionRate,
    median_response_minutes: medianResponseMinutes,
    inquiries: scopedInquiries.length,
    active_listings: activeListings,
    response_samples: responseTimes.length,
  }
}

function metricValue(row, metric) {
  if (metric === 'revenue') return row.revenue
  if (metric === 'closings') return row.closings
  if (metric === 'response_time') return row.median_response_minutes ?? Number.MAX_SAFE_INTEGER
  return row.conversion_rate ?? -1
}

function sortAgents(rows, metric) {
  const sorted = [...rows]
  if (metric === 'response_time') {
    sorted.sort((a, b) => {
      const av = a.median_response_minutes ?? Number.MAX_SAFE_INTEGER
      const bv = b.median_response_minutes ?? Number.MAX_SAFE_INTEGER
      return av - bv
    })
  } else {
    sorted.sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
  }
  return sorted
}

export async function getAgentLeaderboard({
  agencyId,
  startDate,
  endDate,
  metric = 'revenue',
} = {}) {
  if (!agencyId) throw new Error('agencyId is required')
  if (!METRICS.includes(metric)) throw new Error(`metric must be one of: ${METRICS.join(', ')}`)

  const defaults = defaultWindow()
  const start = parseDate(startDate) || defaults.start
  const end = parseDate(endDate) || defaults.end
  const previous = previousWindow(start, end)

  // Resolve the agency's agents first (agents loaded in full — activeAgentsForAgency
  // also matches agents linked via agency_members, which an agency_id filter would
  // drop). Then push the discovered scope down: agency_id onto the fact tables,
  // the agent-id set onto conversations, and the conversation-id set onto messages.
  const [allAgents, allAgencyMembers] = await Promise.all([
    findAll('agents'),
    findAll('agency_members', buildScopeFilter({ columns: { agency_id: agencyId } })),
  ])

  const agents = activeAgentsForAgency(allAgencyMembers, allAgents, agencyId)
  const agentIds = new Set(agents.map((row) => row.id))

  const agencyScope = buildScopeFilter({ columns: { agency_id: agencyId } })
  const [allInquiries, allOpportunities, allProperties, allConversations] = await Promise.all([
    findAll('inquiries', agencyScope),
    findAll('opportunities', agencyScope),
    findAll('properties', agencyScope),
    findAll('conversations', buildScopeFilter({ columns: { assigned_agent_id: [...agentIds] } })),
  ])

  const conversations = allConversations.filter((row) => agentIds.has(row.assigned_agent_id))

  const allMessages = await findAll('conversation_messages', buildScopeFilter({
    columns: { conversation_id: conversations.map((row) => row.id) },
  }))

  const messagesByConversation = new Map()
  for (const message of allMessages) {
    if (!messagesByConversation.has(message.conversation_id)) {
      messagesByConversation.set(message.conversation_id, [])
    }
    messagesByConversation.get(message.conversation_id).push(message)
  }

  const baseArgs = {
    agencyId,
    inquiries: allInquiries,
    opportunities: allOpportunities,
    properties: allProperties,
    conversations,
    messagesByConversation,
  }

  const currentRows = agents.map((agent) =>
    computeAgentStats({ agent, ...baseArgs, windowStart: start, windowEnd: end }),
  )
  const previousRows = agents.map((agent) =>
    computeAgentStats({ agent, ...baseArgs, windowStart: previous.start, windowEnd: previous.end }),
  )
  const previousByAgent = new Map(previousRows.map((row) => [row.agent_id, row]))

  const ranked = sortAgents(currentRows, metric).map((row, index) => {
    const prior = previousByAgent.get(row.agent_id)
    const currentMetric = metricValue(row, metric)
    const previousMetric = prior ? metricValue(prior, metric) : null
    return {
      ...row,
      rank: index + 1,
      medal: medalForRank(index + 1),
      trend: trendDirection(currentMetric, previousMetric, metric),
      previous_metric_value: previousMetric === Number.MAX_SAFE_INTEGER ? null : previousMetric,
      metric_value: currentMetric === Number.MAX_SAFE_INTEGER ? null : currentMetric,
      member_href: '/agency',
    }
  })

  return {
    generated_at: new Date().toISOString(),
    agency_id: agencyId,
    metric,
    available_metrics: METRICS,
    filters: {
      start_date: startDate || start.toISOString().slice(0, 10),
      end_date: endDate || end.toISOString().slice(0, 10),
    },
    leaderboard: ranked,
    summary: {
      agents_ranked: ranked.length,
      total_revenue: ranked.reduce((sum, row) => sum + row.revenue, 0),
      total_closings: ranked.reduce((sum, row) => sum + row.closings, 0),
    },
  }
}

export { METRICS }
export default { getAgentLeaderboard, METRICS }
