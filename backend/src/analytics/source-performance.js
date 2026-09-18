/**
 * SHR-INT-002 — Bazaar performance in analytics (lead-source breakdown).
 *
 * Attributes leads (conversations), inquiries, and closed deals to the SOURCE
 * that produced them — `direct`, `bazaar` (Real Estate Bazaar marketplace), or
 * a syndication portal (`property_finder`, `bayut`, `dubizzle`, `olx`, …). The
 * `bazaar` row is surfaced first-class so an agent/agency can see the ROI of
 * marketplace syndication (SHR-INT-001) alongside every other channel.
 *
 * Honest metrics only: everything here is a real count derived from stored
 * `source` columns (conversations.source, inquiries.source) plus deal
 * attribution via inquiries.inquiry_id → opportunities. No synthetic CTR.
 */
import { findAll } from '../db.js'

export const BAZAAR_SOURCE = 'bazaar'

function parseDate(date) {
  if (!date) return null
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? null : d
}

function isInRange(iso, startDate, endDate) {
  if (!iso) return true // undated rows are not excluded by a date filter
  const d = parseDate(iso)
  if (!d) return true
  if (startDate && d < startDate) return false
  if (endDate && d >= endDate) return false
  return true
}

/** null / '' / unknown portal → 'direct' so every lead lands in exactly one bucket. */
function normalizeSource(value) {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return s || 'direct'
}

function inScope(row, { agentId, agencyId, agentKey }) {
  if (agencyId) return row.agency_id === agencyId
  if (agentId) return row[agentKey] === agentId
  return true
}

function emptyBucket(source) {
  return { source, conversations: 0, inquiries: 0, deals: 0, won: 0, won_value: 0 }
}

export async function getSourcePerformance({ agentId, agencyId, startDate, endDate } = {}) {
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  const scope = { agentId, agencyId, agentKey: 'assigned_agent_id' }
  const crmScope = { agentId, agencyId, agentKey: 'agent_id' }

  const [allConversations, allInquiries, allOpportunities] = await Promise.all([
    findAll('conversations'),
    findAll('inquiries'),
    findAll('opportunities'),
  ])

  const conversations = allConversations.filter(
    (c) => inScope(c, scope) && isInRange(c.created_at, start, end),
  )
  const inquiries = allInquiries.filter(
    (i) => inScope(i, crmScope) && isInRange(i.created_at, start, end),
  )
  const opportunities = allOpportunities.filter(
    (o) => inScope(o, crmScope) && isInRange(o.created_at, start, end),
  )

  // inquiry id → source, so a deal can be attributed to the source of the
  // inquiry that spawned it. Built from all inquiries (an opp's inquiry may
  // predate the requested window).
  const inquirySourceById = new Map()
  for (const inq of allInquiries) inquirySourceById.set(inq.id, normalizeSource(inq.source))

  const buckets = new Map()
  const bucketFor = (source) => {
    if (!buckets.has(source)) buckets.set(source, emptyBucket(source))
    return buckets.get(source)
  }

  for (const c of conversations) bucketFor(normalizeSource(c.source)).conversations += 1
  for (const i of inquiries) bucketFor(normalizeSource(i.source)).inquiries += 1
  for (const o of opportunities) {
    const source = o.inquiry_id && inquirySourceById.has(o.inquiry_id)
      ? inquirySourceById.get(o.inquiry_id)
      : 'direct'
    const bucket = bucketFor(source)
    bucket.deals += 1
    if (o.stage === 'closed_won') {
      bucket.won += 1
      bucket.won_value += Number(o.deal_value) || 0
    }
  }

  const totals = {
    conversations: conversations.length,
    inquiries: inquiries.length,
    deals: opportunities.length,
    won: opportunities.filter((o) => o.stage === 'closed_won').length,
    won_value: opportunities
      .filter((o) => o.stage === 'closed_won')
      .reduce((sum, o) => sum + (Number(o.deal_value) || 0), 0),
  }

  const withShare = (bucket) => ({
    ...bucket,
    lead_share: totals.conversations ? Math.round((bucket.conversations / totals.conversations) * 100) : 0,
  })

  const sources = [...buckets.values()]
    .map(withShare)
    .sort((a, b) => b.conversations - a.conversations || b.inquiries - a.inquiries || a.source.localeCompare(b.source))

  const bazaar = withShare(buckets.get(BAZAAR_SOURCE) || emptyBucket(BAZAAR_SOURCE))

  return {
    generated_at: new Date().toISOString(),
    scope: {
      agent_id: agentId || null,
      agency_id: agencyId || null,
      start_date: startDate || null,
      end_date: endDate || null,
    },
    totals,
    sources,
    bazaar,
  }
}

export default { getSourcePerformance, BAZAAR_SOURCE }
