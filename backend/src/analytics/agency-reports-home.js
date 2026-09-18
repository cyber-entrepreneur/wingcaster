import { findAll } from '../db.js'

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

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function dailyBuckets(days, endDate = new Date()) {
  const end = startOfUtcDay(endDate)
  const buckets = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(end)
    day.setUTCDate(end.getUTCDate() - i)
    buckets.push({
      date: day.toISOString().slice(0, 10),
      start: day,
      end: new Date(day.getTime() + 86400000),
    })
  }
  return buckets
}

function countByDay(items, dateKey, days = 7, endDate = new Date()) {
  const buckets = dailyBuckets(days, endDate)
  return buckets.map((bucket) =>
    items.filter((row) => isInRange(row[dateKey], bucket.start, bucket.end)).length,
  )
}

function sum(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0)
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

export async function getAgencyReportsHome({ agencyId } = {}) {
  if (!agencyId) throw new Error('agencyId is required')

  const now = new Date()
  const windowStart = new Date(now)
  windowStart.setUTCDate(windowStart.getUTCDate() - 30)

  const [
    allProperties,
    allInquiries,
    allOpportunities,
    allAgents,
    allCampaigns,
    allEnrollments,
    allWebsiteAnalytics,
    allAiUsage,
    allAgencyMembers,
  ] = await Promise.all([
    findAll('properties'),
    findAll('inquiries'),
    findAll('opportunities'),
    findAll('agents'),
    findAll('campaigns'),
    findAll('campaign_enrollments'),
    findAll('website_analytics'),
    findAll('ai_usage_daily'),
    findAll('agency_members'),
  ])

  const properties = allProperties.filter((row) => row.agency_id === agencyId)
  const inquiries = allInquiries.filter((row) => row.agency_id === agencyId)
  const opportunities = allOpportunities.filter((row) => row.agency_id === agencyId)
  const campaigns = allCampaigns.filter((row) => row.agency_id === agencyId)
  const websiteEvents = allWebsiteAnalytics.filter((row) => row.agency_id === agencyId)
  const aiUsage = allAiUsage.filter((row) => row.tenant_id === agencyId)
  const agents = activeAgentsForAgency(allAgencyMembers, allAgents, agencyId)

  const campaignIds = new Set(campaigns.map((row) => row.id))
  const enrollments = allEnrollments.filter((row) => campaignIds.has(row.campaign_id))

  const recentInquiries = inquiries.filter((row) => isInRange(row.created_at, windowStart, now))
  const recentOpportunities = opportunities.filter((row) => isInRange(row.created_at, windowStart, now))
  const closedWon = opportunities.filter((row) => row.stage === 'closed_won')
  const closedWonRecent = closedWon.filter((row) =>
    isInRange(row.closed_at || row.updated_at || row.created_at, windowStart, now),
  )

  const activeListings = properties.filter((row) => (row.status || 'active') === 'active')
  const totalViews = sum(properties.map((row) => row.views || row.data?.views || 0))
  const activeCampaigns = campaigns.filter((row) => row.status === 'active')
  const creditSuggestions = sum(aiUsage.map((row) => row.suggestions_used || 0))
  const siteSessions = websiteEvents.length

  const agentWins = new Map()
  for (const row of closedWon) {
    if (!row.agent_id) continue
    agentWins.set(row.agent_id, (agentWins.get(row.agent_id) || 0) + 1)
  }
  let topAgentName = null
  let topAgentWins = 0
  for (const [agentId, wins] of agentWins.entries()) {
    if (wins <= topAgentWins) continue
    topAgentWins = wins
    const agent = agents.find((row) => row.id === agentId)
    topAgentName = agent?.name || agent?.email || agentId
  }

  const revenueTotal = sum(
    closedWonRecent.map((row) => row.deal_value || row.data?.deal_value || 0),
  )

  const cards = [
    {
      id: 'listings',
      report_id: 'AGN-REP-002',
      title: 'Listings performance',
      href: '/agency/reports/listings',
      kpi_label: 'Active listings',
      kpi_value: activeListings.length,
      secondary_label: 'Total views (30d)',
      secondary_value: totalViews,
      trend: countByDay(properties, 'created_at'),
    },
    {
      id: 'leads',
      report_id: 'AGN-REP-003',
      title: 'Lead conversion funnel',
      href: '/agency/reports/leads',
      kpi_label: 'Inquiries (30d)',
      kpi_value: recentInquiries.length,
      secondary_label: 'Closed won',
      secondary_value: closedWonRecent.length,
      trend: countByDay(inquiries, 'created_at'),
    },
    {
      id: 'agents',
      report_id: 'AGN-REP-004',
      title: 'Agent leaderboard',
      href: '/agency/reports/agents',
      kpi_label: 'Active agents',
      kpi_value: agents.length,
      secondary_label: topAgentName ? `Top: ${topAgentName}` : 'Top performer',
      secondary_value: topAgentWins,
      trend: countByDay(closedWon, 'closed_at'),
    },
    {
      id: 'credits',
      report_id: 'AGN-REP-005',
      title: 'Credit spend',
      href: '/agency/reports/credits',
      kpi_label: 'AI suggestions used',
      kpi_value: creditSuggestions,
      secondary_label: 'Usage rows',
      secondary_value: aiUsage.length,
      trend: countByDay(aiUsage, 'usage_date'),
    },
    {
      id: 'campaigns',
      report_id: 'AGN-REP-006',
      title: 'Campaign performance',
      href: '/agency/reports/campaigns',
      kpi_label: 'Active campaigns',
      kpi_value: activeCampaigns.length,
      secondary_label: 'Enrollments',
      secondary_value: enrollments.length,
      trend: countByDay(enrollments, 'created_at'),
    },
    {
      id: 'traffic',
      report_id: 'AGN-REP-002',
      title: 'White-label site traffic',
      href: '/white-label',
      kpi_label: 'Site events',
      kpi_value: siteSessions,
      secondary_label: 'Unique pages',
      secondary_value: new Set(websiteEvents.map((row) => row.page).filter(Boolean)).size,
      trend: countByDay(websiteEvents, 'created_at'),
    },
    {
      id: 'revenue',
      report_id: 'AGN-REP-007',
      title: 'Revenue attribution',
      href: '/agency/reports/revenue',
      kpi_label: 'Attributed revenue (30d)',
      kpi_value: revenueTotal,
      secondary_label: 'Pipeline deals',
      secondary_value: recentOpportunities.length,
      trend: countByDay(closedWon, 'closed_at'),
    },
  ]

  return {
    generated_at: now.toISOString(),
    agency_id: agencyId,
    window_days: 30,
    cards,
    totals: {
      listings: properties.length,
      inquiries: inquiries.length,
      opportunities: opportunities.length,
      agents: agents.length,
      campaigns: campaigns.length,
    },
  }
}

export default { getAgencyReportsHome }
