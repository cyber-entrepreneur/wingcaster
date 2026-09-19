/**
 * AGN-REP-008 — Agency custom report builder (catalog, persistence, execution).
 */

import { randomUUID } from 'node:crypto'
import { findAll, query } from '../../db.js'

export const METRIC_CATALOG = Object.freeze([
  { key: 'listings_count', label: 'Listings created', category: 'listings', aggregation: 'count' },
  { key: 'active_listings', label: 'Active listings', category: 'listings', aggregation: 'count' },
  { key: 'inquiries_count', label: 'Inquiries', category: 'leads', aggregation: 'count' },
  { key: 'opportunities_won', label: 'Opportunities won', category: 'leads', aggregation: 'count' },
  { key: 'campaign_enrollments', label: 'Campaign enrollments', category: 'campaigns', aggregation: 'count' },
  { key: 'credit_spend', label: 'Credit spend', category: 'billing', aggregation: 'sum' },
  { key: 'site_sessions', label: 'Site sessions', category: 'traffic', aggregation: 'count' },
])

export const DIMENSION_CATALOG = Object.freeze([
  { key: 'agent', label: 'Agent' },
  { key: 'area', label: 'Area' },
  { key: 'property_type', label: 'Property type' },
  { key: 'month', label: 'Month' },
])

const METRIC_KEYS = new Set(METRIC_CATALOG.map((m) => m.key))
const DIMENSION_KEYS = new Set(DIMENSION_CATALOG.map((d) => d.key))

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function inRange(iso, start, end) {
  if (!iso) return false
  const d = parseDate(iso)
  if (!d) return false
  if (start && d < start) return false
  if (end && d >= end) return false
  return true
}

function monthKey(iso) {
  const d = parseDate(iso)
  if (!d) return 'unknown'
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function normalizeDefinition(definition = {}) {
  const metrics = Array.isArray(definition.metrics)
    ? definition.metrics.filter((key) => METRIC_KEYS.has(key))
    : []
  const dimensions = Array.isArray(definition.dimensions)
    ? definition.dimensions.filter((key) => DIMENSION_KEYS.has(key))
    : []
  const filters = typeof definition.filters === 'object' && definition.filters ? definition.filters : {}
  return {
    metrics,
    dimensions,
    filters: {
      date_from: filters.date_from || null,
      date_to: filters.date_to || null,
      agent_id: filters.agent_id || null,
      area: filters.area || null,
      property_type: filters.property_type || null,
    },
  }
}

export function validateCustomReportPayload({ name, definition }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { ok: false, error: 'name is required' }
  }
  const normalized = normalizeDefinition(definition)
  if (!normalized.metrics.length) {
    return { ok: false, error: 'At least one metric is required' }
  }
  return { ok: true, name: name.trim(), definition: normalized }
}

export function getCustomReportCatalog() {
  return {
    metrics: METRIC_CATALOG,
    dimensions: DIMENSION_CATALOG,
  }
}

export async function listAgencyCustomReports(agencyId) {
  const rows = await query(
    `SELECT id, agency_id, name, definition, created_by, updated_by, created_at, updated_at
       FROM public.agency_custom_reports
      WHERE agency_id = $1
      ORDER BY updated_at DESC`,
    [agencyId],
  )
  return rows
}

export async function getAgencyCustomReport(agencyId, reportId) {
  const rows = await query(
    `SELECT id, agency_id, name, definition, created_by, updated_by, created_at, updated_at
       FROM public.agency_custom_reports
      WHERE agency_id = $1 AND id = $2`,
    [agencyId, reportId],
  )
  return rows[0] || null
}

export async function createAgencyCustomReport(agencyId, { name, definition }, actorUserId) {
  const validation = validateCustomReportPayload({ name, definition })
  if (!validation.ok) return validation

  const id = randomUUID()
  await query(
    `INSERT INTO public.agency_custom_reports (
       id, agency_id, name, definition, created_by, updated_by, created_at, updated_at
     ) VALUES ($1, $2, $3, $4::jsonb, $5, $5, NOW(), NOW())`,
    [id, agencyId, validation.name, JSON.stringify(validation.definition), actorUserId],
  )
  return { ok: true, report: await getAgencyCustomReport(agencyId, id) }
}

export async function updateAgencyCustomReport(agencyId, reportId, { name, definition }, actorUserId) {
  const existing = await getAgencyCustomReport(agencyId, reportId)
  if (!existing) return { ok: false, status: 404, error: 'Report not found' }

  const validation = validateCustomReportPayload({
    name: name ?? existing.name,
    definition: definition ?? existing.definition,
  })
  if (!validation.ok) return validation

  await query(
    `UPDATE public.agency_custom_reports
        SET name = $3,
            definition = $4::jsonb,
            updated_by = $5,
            updated_at = NOW()
      WHERE agency_id = $1 AND id = $2`,
    [agencyId, reportId, validation.name, JSON.stringify(validation.definition), actorUserId],
  )
  return { ok: true, report: await getAgencyCustomReport(agencyId, reportId) }
}

async function agencyAgents(agencyId) {
  const agents = await findAll('agents', (row) => row.agency_id === agencyId)
  const agentNameById = new Map(agents.map((row) => [row.id, row.name || row.email || row.id]))
  return { agents, agentNameById }
}

function dimensionValue(row, dimension, agentNameById) {
  switch (dimension) {
    case 'agent':
      return row.agent_id ? (agentNameById.get(row.agent_id) || row.agent_id) : 'Unassigned'
    case 'area':
      return row.area || row.area_name || row.location || 'Unknown area'
    case 'property_type':
      return row.property_type || 'Unknown type'
    case 'month':
      return monthKey(row.created_at || row.closed_at || row.updated_at)
    default:
      return 'All'
  }
}

function rowKey(row, dimensions, agentNameById) {
  return dimensions.map((dim) => `${dim}:${dimensionValue(row, dim, agentNameById)}`).join('|')
}

function metricRowsForAgency(agencyId, filters, start, end) {
  return Promise.all([
    findAll('properties', (row) => row.agency_id === agencyId),
    findAll('inquiries', (row) => row.agency_id === agencyId),
    findAll('opportunities', (row) => row.agency_id === agencyId),
    findAll('campaigns', (row) => row.agency_id === agencyId),
    findAll('campaign_enrollments'),
    findAll('website_analytics', (row) => row.agency_id === agencyId),
    findAll('ai_usage_daily', (row) => row.tenant_id === agencyId),
  ]).then(([properties, inquiries, opportunities, campaigns, enrollments, websiteEvents, aiUsage]) => {
    const campaignIds = new Set(campaigns.map((row) => row.id))
    const scopedEnrollments = enrollments.filter((row) => campaignIds.has(row.campaign_id))

    const filterRow = (row, dateKey = 'created_at') => {
      if (filters.agent_id && row.agent_id !== filters.agent_id) return false
      if (filters.area) {
        const area = row.area || row.area_name || row.location || ''
        if (!String(area).toLowerCase().includes(String(filters.area).toLowerCase())) return false
      }
      if (filters.property_type && row.property_type !== filters.property_type) return false
      if (!inRange(row[dateKey], start, end)) return false
      return true
    }

    return {
      listings: properties.filter((row) => filterRow(row, 'created_at')),
      activeListings: properties.filter((row) => (row.status || 'active') === 'active' && filterRow(row, 'created_at')),
      inquiries: inquiries.filter((row) => filterRow(row, 'created_at')),
      opportunitiesWon: opportunities.filter((row) =>
        row.stage === 'closed_won' && filterRow(row, row.closed_at ? 'closed_at' : 'updated_at'),
      ),
      enrollments: scopedEnrollments.filter((row) => filterRow(row, 'created_at')),
      websiteEvents: websiteEvents.filter((row) => filterRow(row, 'created_at')),
      aiUsage: aiUsage.filter((row) => filterRow(row, 'date')),
    }
  })
}

function computeMetric(metricKey, buckets, agentNameById) {
  const sourceMap = {
    listings_count: buckets.listings,
    active_listings: buckets.activeListings,
    inquiries_count: buckets.inquiries,
    opportunities_won: buckets.opportunitiesWon,
    campaign_enrollments: buckets.enrollments,
    site_sessions: buckets.websiteEvents,
    credit_spend: buckets.aiUsage,
  }
  const rows = sourceMap[metricKey] || []
  if (metricKey === 'credit_spend') {
    return rows.reduce((sum, row) => sum + Number(row.suggestions_used || row.credits_used || 0), 0)
  }
  return rows.length
}

export async function runAgencyCustomReport(agencyId, definition) {
  const normalized = normalizeDefinition(definition)
  const start = parseDate(normalized.filters.date_from)
  const end = parseDate(normalized.filters.date_to)
  const { agentNameById } = await agencyAgents(agencyId)
  const buckets = await metricRowsForAgency(agencyId, normalized.filters, start, end)

  if (!normalized.dimensions.length) {
    const totals = {}
    for (const metricKey of normalized.metrics) {
      totals[metricKey] = computeMetric(metricKey, buckets, agentNameById)
    }
    return {
      definition: normalized,
      rows: [{ dimensions: {}, metrics: totals }],
      totals,
    }
  }

  const grouped = new Map()
  const allSourceRows = [
    ...buckets.listings.map((row) => ({ ...row, _metricSource: 'listings_count' })),
    ...buckets.inquiries.map((row) => ({ ...row, _metricSource: 'inquiries_count' })),
    ...buckets.opportunitiesWon.map((row) => ({ ...row, _metricSource: 'opportunities_won' })),
    ...buckets.enrollments.map((row) => ({ ...row, _metricSource: 'campaign_enrollments' })),
    ...buckets.websiteEvents.map((row) => ({ ...row, _metricSource: 'site_sessions' })),
    ...buckets.aiUsage.map((row) => ({ ...row, _metricSource: 'credit_spend' })),
  ]

  for (const row of allSourceRows) {
    const key = rowKey(row, normalized.dimensions, agentNameById)
    if (!grouped.has(key)) {
      const dimensions = {}
      for (const dim of normalized.dimensions) {
        dimensions[dim] = dimensionValue(row, dim, agentNameById)
      }
      grouped.set(key, { dimensions, metrics: Object.fromEntries(normalized.metrics.map((m) => [m, 0])) })
    }
    const bucket = grouped.get(key)
    const metricForRow = row._metricSource
    if (normalized.metrics.includes(metricForRow)) {
      if (metricForRow === 'credit_spend') {
        bucket.metrics[metricForRow] += Number(row.suggestions_used || row.credits_used || 0)
      } else {
        bucket.metrics[metricForRow] += 1
      }
    }
  }

  const rows = [...grouped.values()].sort((a, b) => {
    const left = Object.values(a.dimensions).join('|')
    const right = Object.values(b.dimensions).join('|')
    return left.localeCompare(right)
  })

  const totals = {}
  for (const metricKey of normalized.metrics) {
    totals[metricKey] = rows.reduce((sum, row) => sum + Number(row.metrics[metricKey] || 0), 0)
  }

  return { definition: normalized, rows, totals }
}
