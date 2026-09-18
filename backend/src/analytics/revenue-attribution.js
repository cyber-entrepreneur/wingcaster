import { findAll } from '../db.js'
import { ATTRIBUTION_SOURCES } from '../closed-transactions.js'

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

function formatMonthBucket(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function labelForSource(source) {
  return String(source || 'other').replace(/_/g, ' ')
}

function revenueValue(row) {
  return Number(row.final_sold_price) || 0
}

export async function getRevenueAttribution({
  agencyId,
  startDate,
  endDate,
  channel,
  agentId,
  campaignId,
} = {}) {
  if (!agencyId) throw new Error('agencyId is required')

  const start = parseDate(startDate)
  const end = parseDate(endDate)

  const [transactions, agents, campaigns, enrollments] = await Promise.all([
    findAll('closed_transactions'),
    findAll('agents'),
    findAll('campaigns'),
    findAll('campaign_enrollments'),
  ])

  const agentNames = new Map(agents.map((row) => [row.id, row.name || row.email || row.id]))
  const campaignNames = new Map(
    campaigns
      .filter((row) => row.agency_id === agencyId)
      .map((row) => [row.id, row.name || row.id]),
  )

  const contactCampaign = new Map()
  for (const enrollment of enrollments) {
    if (!enrollment.contact_id || !enrollment.campaign_id) continue
    const campaign = campaigns.find((row) => row.id === enrollment.campaign_id)
    if (!campaign || campaign.agency_id !== agencyId) continue
    if (!contactCampaign.has(enrollment.contact_id)) {
      contactCampaign.set(enrollment.contact_id, enrollment.campaign_id)
    }
  }

  let scoped = transactions.filter((row) => {
    if (row.agency_id !== agencyId) return false
    if (!isInRange(row.closed_at, start, end)) return false
    if (channel && row.attribution_source !== channel) return false
    if (agentId && row.agent_id !== agentId) return false
    if (campaignId) {
      const linked = row.contact_id ? contactCampaign.get(row.contact_id) : null
      if (linked !== campaignId) return false
    }
    return true
  })

  const totalRevenue = scoped.reduce((sum, row) => sum + revenueValue(row), 0)
  const currency = scoped.find((row) => row.currency)?.currency || 'USD'

  const byChannelMap = new Map()
  for (const row of scoped) {
    const key = row.attribution_source || 'other'
    if (!byChannelMap.has(key)) {
      byChannelMap.set(key, { channel: key, label: labelForSource(key), revenue: 0, count: 0 })
    }
    const bucket = byChannelMap.get(key)
    bucket.revenue += revenueValue(row)
    bucket.count += 1
  }

  const byAgentMap = new Map()
  for (const row of scoped) {
    const key = row.agent_id || 'unassigned'
    if (!byAgentMap.has(key)) {
      byAgentMap.set(key, {
        agent_id: key,
        agent_name: agentNames.get(key) || (key === 'unassigned' ? 'Unassigned' : key),
        revenue: 0,
        count: 0,
      })
    }
    const bucket = byAgentMap.get(key)
    bucket.revenue += revenueValue(row)
    bucket.count += 1
  }

  const byCampaignMap = new Map()
  for (const row of scoped) {
    const key = row.contact_id ? contactCampaign.get(row.contact_id) || 'unattributed' : 'unattributed'
    if (!byCampaignMap.has(key)) {
      byCampaignMap.set(key, {
        campaign_id: key,
        campaign_name: key === 'unattributed' ? 'Unattributed' : campaignNames.get(key) || key,
        revenue: 0,
        count: 0,
      })
    }
    const bucket = byCampaignMap.get(key)
    bucket.revenue += revenueValue(row)
    bucket.count += 1
  }

  const waterfallMap = new Map()
  for (const row of scoped) {
    const d = parseDate(row.closed_at)
    if (!d) continue
    const bucket = formatMonthBucket(d)
    waterfallMap.set(bucket, (waterfallMap.get(bucket) || 0) + revenueValue(row))
  }

  const sankeyNodes = []
  const sankeyLinks = []
  const nodeIds = new Set()

  function ensureNode(id, label, group) {
    if (!nodeIds.has(id)) {
      nodeIds.add(id)
      sankeyNodes.push({ id, label, group })
    }
  }

  const channelAgentCounts = new Map()
  for (const row of scoped) {
    const channelId = `channel:${row.attribution_source || 'other'}`
    const agentKey = row.agent_id || 'unassigned'
    const agentNodeId = `agent:${agentKey}`
    const key = `${channelId}->${agentNodeId}`
    channelAgentCounts.set(key, (channelAgentCounts.get(key) || 0) + revenueValue(row))
  }

  for (const [key, value] of channelAgentCounts) {
    const [channelNodeId, agentNodeId] = key.split('->')
    const channelLabel = labelForSource(channelNodeId.replace('channel:', ''))
    const agentKey = agentNodeId.replace('agent:', '')
    ensureNode(channelNodeId, channelLabel, 'channel')
    ensureNode(
      agentNodeId,
      agentNames.get(agentKey) || (agentKey === 'unassigned' ? 'Unassigned' : agentKey),
      'agent',
    )
    sankeyLinks.push({ source: channelNodeId, target: agentNodeId, value: Math.round(value) })
  }

  const filterOptions = {
    channels: [...ATTRIBUTION_SOURCES],
    agents: [...new Set(scoped.map((row) => row.agent_id).filter(Boolean))].map((id) => ({
      id,
      name: agentNames.get(id) || id,
    })),
    campaigns: [...campaignNames.entries()].map(([id, name]) => ({ id, name })),
  }

  return {
    generated_at: new Date().toISOString(),
    scope: {
      agency_id: agencyId,
      start_date: startDate || null,
      end_date: endDate || null,
      filters: {
        channel: channel || null,
        agent_id: agentId || null,
        campaign_id: campaignId || null,
      },
    },
    summary: {
      total_revenue: Math.round(totalRevenue),
      transaction_count: scoped.length,
      average_deal_value: scoped.length ? Math.round(totalRevenue / scoped.length) : 0,
      currency,
    },
    by_channel: [...byChannelMap.values()].sort((a, b) => b.revenue - a.revenue),
    by_agent: [...byAgentMap.values()].sort((a, b) => b.revenue - a.revenue),
    by_campaign: [...byCampaignMap.values()].sort((a, b) => b.revenue - a.revenue),
    waterfall: [...waterfallMap.entries()]
      .map(([label, value]) => ({ label, value: Math.round(value) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    sankey: { nodes: sankeyNodes, links: sankeyLinks },
    transactions: scoped
      .map((row) => ({
        id: row.id,
        closed_at: row.closed_at,
        agent_id: row.agent_id,
        agent_name: agentNames.get(row.agent_id) || row.agent_id,
        attribution_source: row.attribution_source,
        channel_label: labelForSource(row.attribution_source),
        final_sold_price: revenueValue(row),
        currency: row.currency || currency,
        transaction_type: row.transaction_type,
        listing_id: row.listing_id,
        campaign_id: row.contact_id ? contactCampaign.get(row.contact_id) || null : null,
        campaign_name: row.contact_id
          ? campaignNames.get(contactCampaign.get(row.contact_id) || '') || null
          : null,
      }))
      .sort((a, b) => new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime()),
    filter_options: filterOptions,
  }
}

export default { getRevenueAttribution }
