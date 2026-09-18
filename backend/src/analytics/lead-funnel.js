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

function pct(numerator, denominator) {
  if (!denominator) return null
  return Math.round((numerator / denominator) * 100)
}

function normalizeSource(source) {
  const key = String(source || 'unknown').trim()
  return key || 'unknown'
}

function outcomeForInquiry(inquiryId, opportunityByInquiry) {
  const opp = opportunityByInquiry.get(inquiryId)
  if (!opp) return 'no_opportunity'
  if (opp.stage === 'closed_won') return 'won'
  if (opp.stage === 'closed_lost') return 'lost'
  return 'pipeline'
}

export async function getLeadFunnel({
  agencyId,
  startDate,
  endDate,
  source,
  agentId,
  area,
} = {}) {
  if (!agencyId) throw new Error('agencyId is required')

  const start = parseDate(startDate)
  const end = parseDate(endDate)

  const [allInquiries, allViewings, allOpportunities, allProperties, allAgents] = await Promise.all([
    findAll('inquiries'),
    findAll('viewings'),
    findAll('opportunities'),
    findAll('properties'),
    findAll('agents'),
  ])

  const propertyById = new Map(allProperties.map((p) => [p.id, p]))
  const agentNames = new Map(allAgents.map((a) => [a.id, a.name || a.email || a.id]))

  const scopedInquiries = allInquiries.filter((row) => {
    if (row.agency_id !== agencyId) return false
    if (!isInRange(row.created_at, start, end)) return false
    if (source && normalizeSource(row.source) !== normalizeSource(source)) return false
    if (agentId && row.agent_id !== agentId) return false
    if (area) {
      const property = row.property_id ? propertyById.get(row.property_id) : null
      const matchArea = property && (property.neighborhood === area || property.city === area)
      if (!matchArea) return false
    }
    return true
  })

  const inquiryIds = new Set(scopedInquiries.map((row) => row.id))

  const scopedViewings = allViewings.filter(
    (row) => row.agency_id === agencyId && row.inquiry_id && inquiryIds.has(row.inquiry_id),
  )

  const scopedOpportunities = allOpportunities.filter(
    (row) => row.agency_id === agencyId && row.inquiry_id && inquiryIds.has(row.inquiry_id),
  )

  const inquiryIdsWithViewing = new Set(scopedViewings.map((row) => row.inquiry_id))
  const opportunityByInquiry = new Map(
    scopedOpportunities
      .filter((row) => row.inquiry_id)
      .map((row) => [row.inquiry_id, row]),
  )

  const closedWon = scopedOpportunities.filter((row) => row.stage === 'closed_won')
  const closedLost = scopedOpportunities.filter((row) => row.stage === 'closed_lost')

  const funnel = {
    inquiries: scopedInquiries.length,
    viewings: inquiryIdsWithViewing.size,
    opportunities: scopedOpportunities.length,
    closed_won: closedWon.length,
    closed_lost: closedLost.length,
  }

  const conversionRates = {
    inquiry_to_viewing: pct(funnel.viewings, funnel.inquiries),
    viewing_to_opportunity: pct(funnel.opportunities, funnel.viewings),
    opportunity_to_won: pct(funnel.closed_won, funnel.opportunities),
    inquiry_to_won: pct(funnel.closed_won, funnel.inquiries),
  }

  const byStage = [
    { stage: 'inquiry', count: funnel.inquiries },
    { stage: 'viewing', count: funnel.viewings },
    { stage: 'opportunity', count: funnel.opportunities },
    { stage: 'closed_won', count: funnel.closed_won },
    { stage: 'closed_lost', count: funnel.closed_lost },
  ]

  const bySourceMap = new Map()
  for (const inquiry of scopedInquiries) {
    const key = normalizeSource(inquiry.source)
    if (!bySourceMap.has(key)) {
      bySourceMap.set(key, {
        source: key,
        inquiries: 0,
        viewings: 0,
        opportunities: 0,
        won: 0,
        won_value: 0,
      })
    }
    const bucket = bySourceMap.get(key)
    bucket.inquiries += 1
    if (inquiryIdsWithViewing.has(inquiry.id)) bucket.viewings += 1
    const opp = opportunityByInquiry.get(inquiry.id)
    if (opp) {
      bucket.opportunities += 1
      if (opp.stage === 'closed_won') {
        bucket.won += 1
        bucket.won_value += Number(opp.deal_value) || 0
      }
    }
  }

  const byAgentMap = new Map()
  for (const inquiry of scopedInquiries) {
    const key = inquiry.agent_id || 'unassigned'
    if (!byAgentMap.has(key)) {
      byAgentMap.set(key, {
        agent_id: key,
        agent_name: agentNames.get(key) || (key === 'unassigned' ? 'Unassigned' : key),
        inquiries: 0,
        viewings: 0,
        opportunities: 0,
        won: 0,
      })
    }
    const bucket = byAgentMap.get(key)
    bucket.inquiries += 1
    if (inquiryIdsWithViewing.has(inquiry.id)) bucket.viewings += 1
    const opp = opportunityByInquiry.get(inquiry.id)
    if (opp) {
      bucket.opportunities += 1
      if (opp.stage === 'closed_won') bucket.won += 1
    }
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

  const sourceAgentCounts = new Map()
  const agentOutcomeCounts = new Map()

  for (const inquiry of scopedInquiries) {
    const sourceKey = normalizeSource(inquiry.source)
    const agentKey = inquiry.agent_id || 'unassigned'
    const sourceNodeId = `source:${sourceKey}`
    const agentNodeId = `agent:${agentKey}`
    const outcome = outcomeForInquiry(inquiry.id, opportunityByInquiry)
    const outcomeNodeId = `outcome:${outcome}`

    const saKey = `${sourceNodeId}->${agentNodeId}`
    sourceAgentCounts.set(saKey, (sourceAgentCounts.get(saKey) || 0) + 1)

    const aoKey = `${agentNodeId}->${outcomeNodeId}`
    agentOutcomeCounts.set(aoKey, (agentOutcomeCounts.get(aoKey) || 0) + 1)
  }

  for (const [key, value] of sourceAgentCounts) {
    const [sourceNodeId, agentNodeId] = key.split('->')
    const sourceLabel = sourceNodeId.replace('source:', '')
    const agentIdFromNode = agentNodeId.replace('agent:', '')
    ensureNode(sourceNodeId, sourceLabel, 'source')
    ensureNode(
      agentNodeId,
      agentNames.get(agentIdFromNode) || (agentIdFromNode === 'unassigned' ? 'Unassigned' : agentIdFromNode),
      'agent',
    )
    sankeyLinks.push({ source: sourceNodeId, target: agentNodeId, value })
  }

  for (const [key, value] of agentOutcomeCounts) {
    const [agentNodeId, outcomeNodeId] = key.split('->')
    const outcomeLabel = outcomeNodeId.replace('outcome:', '').replace(/_/g, ' ')
    ensureNode(agentNodeId, sankeyNodes.find((n) => n.id === agentNodeId)?.label || agentNodeId, 'agent')
    ensureNode(outcomeNodeId, outcomeLabel, 'outcome')
    sankeyLinks.push({ source: agentNodeId, target: outcomeNodeId, value })
  }

  const filterOptions = {
    sources: [...new Set(scopedInquiries.map((row) => normalizeSource(row.source)))].sort(),
    agents: [...new Set(scopedInquiries.map((row) => row.agent_id).filter(Boolean))].map((id) => ({
      id,
      name: agentNames.get(id) || id,
    })),
    areas: [
      ...new Set(
        scopedInquiries
          .map((row) => {
            const property = row.property_id ? propertyById.get(row.property_id) : null
            return property?.neighborhood || property?.city || null
          })
          .filter(Boolean),
      ),
    ].sort(),
  }

  return {
    generated_at: new Date().toISOString(),
    scope: {
      agency_id: agencyId,
      start_date: startDate || null,
      end_date: endDate || null,
      filters: {
        source: source || null,
        agent_id: agentId || null,
        area: area || null,
      },
    },
    funnel,
    conversion_rates: conversionRates,
    by_stage: byStage,
    by_source: [...bySourceMap.values()].sort((a, b) => b.inquiries - a.inquiries),
    by_agent: [...byAgentMap.values()].sort((a, b) => b.inquiries - a.inquiries),
    sankey: { nodes: sankeyNodes, links: sankeyLinks },
    filter_options: filterOptions,
  }
}

export default { getLeadFunnel }
