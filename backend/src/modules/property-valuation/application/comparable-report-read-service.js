/**
 * Comparable-report READ surfaces for PA-PVA-008 / 008b — [BE-CMR-01/11/13/14/10].
 *
 * Compute-on-read: severity, market impact, SLA, status vocabulary normalization.
 * Does NOT own decision writes (Agent 5) or bulk/undo/affected (Agent 6).
 */

import { Collections } from '../infrastructure/db.js'
import {
  createMarketImpactService,
  marketImpactTierRank,
  MARKET_IMPACT_TIERS,
} from './market-impact-service.js'
import { resolveSessionEnv, normalizeClientEnv } from '../../../lib/session-env.js'

export const DEFAULT_SLA_HOURS = 48
export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 }

/** Legacy DB status → WF-05 vocabulary (display + filter). */
const LEGACY_STATUS_TO_WF05 = Object.freeze({
  pending: 'pending',
  reviewed: 'confirmed_quarantined',
  dismissed: 'rejected',
  actioned: 'confirmed_removed',
})

const REASON_TO_CATEGORY = Object.freeze({
  incorrect_price: 'wrong_price',
  wrong_price: 'wrong_price',
  wrong_area: 'wrong_area',
  already_sold: 'already_sold',
  duplicate: 'duplicate',
  fake_listing: 'spam',
  spam: 'spam',
  wrong_details: 'other',
  other: 'other',
})

const SOURCE_DISPLAY = Object.freeze({
  agency_owned: 'Agency-owned',
  internal: 'Agency-owned',
  external_scrape: 'External scrape',
  external: 'External scrape',
  agent_report: 'Agent report',
})

function parseWithin(within) {
  const raw = String(within || '7d').trim().toLowerCase()
  if (raw === 'all') return null
  if (raw === '24h') return 24 * 60 * 60 * 1000
  if (raw === '7d') return 7 * 24 * 60 * 60 * 1000
  if (raw === '30d') return 30 * 24 * 60 * 60 * 1000
  const match = raw.match(/^(\d+)(h|d)$/)
  if (!match) return 7 * 24 * 60 * 60 * 1000
  const n = Number(match[1])
  return match[2] === 'h' ? n * 60 * 60 * 1000 : n * 24 * 60 * 60 * 1000
}

function parsePage(value, fallback = 1) {
  const n = Number.parseInt(String(value ?? fallback), 10)
  return Number.isFinite(n) && n >= 1 ? n : fallback
}

function parsePageSize(value) {
  const n = Number.parseInt(String(value ?? DEFAULT_PAGE_SIZE), 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGE_SIZE
  return Math.min(n, MAX_PAGE_SIZE)
}

function asIso(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function hoursBetween(from, to) {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60)
}

function maskEmail(email) {
  const raw = String(email || '')
  const at = raw.indexOf('@')
  if (at <= 0) return null
  const local = raw.slice(0, at)
  const domain = raw.slice(at + 1)
  const domainParts = domain.split('.')
  const tld = domainParts.length > 1 ? domainParts[domainParts.length - 1] : ''
  const domainHead = domainParts[0] || ''
  return `${local.slice(0, 1)}•••@${domainHead.slice(0, 1)}•••${tld ? `.${tld}` : ''}`
}

export function normalizeReportStatus(raw) {
  const s = String(raw || 'pending').trim().toLowerCase()
  if (LEGACY_STATUS_TO_WF05[s]) return LEGACY_STATUS_TO_WF05[s]
  return s
}

export function normalizeReasonCategory(reason, data = {}) {
  if (data.reason_category) return String(data.reason_category)
  const key = String(reason || 'other').trim().toLowerCase()
  return REASON_TO_CATEGORY[key] || 'other'
}

export function deriveSeverity({ reasonCategory, deltaPct, data = {}, marketImpactTier } = {}) {
  if (data.severity) return String(data.severity).toLowerCase()
  const absDelta = Math.abs(Number(deltaPct) || 0)
  if (reasonCategory === 'already_sold' && marketImpactTier === MARKET_IMPACT_TIERS.HIGH) {
    return 'critical'
  }
  if (reasonCategory === 'already_sold' || absDelta >= 20) return 'high'
  if (reasonCategory === 'spam' || reasonCategory === 'wrong_price' || absDelta >= 10) return 'medium'
  if (reasonCategory === 'duplicate') return 'low'
  return 'low'
}

function parseSort(sort) {
  const raw = String(sort || '').trim()
  if (!raw) {
    return [
      { key: 'market_impact', dir: 'desc' },
      { key: 'sla_remaining', dir: 'asc' },
      { key: 'submitted_at', dir: 'asc' },
    ]
  }
  return raw.split(',').map((part) => {
    const [key, dir] = part.split(':').map((s) => s.trim())
    return {
      key: key || 'submitted_at',
      dir: String(dir || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc',
    }
  })
}

function compareBySort(a, b, sortSpec) {
  for (const { key, dir } of sortSpec) {
    let av
    let bv
    if (key === 'market_impact' || key === 'impact') {
      av = marketImpactTierRank(a.market_impact?.tier)
      bv = marketImpactTierRank(b.market_impact?.tier)
    } else if (key === 'sla_remaining' || key === 'sla_hours_remaining') {
      av = a.sla_hours_remaining
      bv = b.sla_hours_remaining
    } else if (key === 'submitted_at' || key === 'created_at') {
      av = new Date(a.created_at).getTime()
      bv = new Date(b.created_at).getTime()
    } else if (key === 'severity') {
      av = SEVERITY_RANK[a.severity] || 0
      bv = SEVERITY_RANK[b.severity] || 0
    } else if (key === 'agent_name' || key === 'reporter_name') {
      av = String(a.reporter?.display_name || '').toLowerCase()
      bv = String(b.reporter?.display_name || '').toLowerCase()
    } else {
      av = a[key]
      bv = b[key]
    }
    if (av === bv) continue
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = av < bv ? -1 : 1
    return dir === 'desc' ? -cmp : cmp
  }
  return 0
}

function startOfWeek(now = new Date()) {
  const d = new Date(now)
  const day = d.getUTCDay() // 0 Sun
  const diff = day === 0 ? 6 : day - 1 // Monday-start
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - diff)
  return d
}

export function createComparableReportReadService({
  dal,
  marketImpactService,
  logger,
  slaHours = DEFAULT_SLA_HOURS,
} = {}) {
  const impactService = marketImpactService || createMarketImpactService({ dal, logger })

  async function loadUser(userId) {
    if (!userId || !dal?.findOne) return null
    return dal.findOne('users', (u) => u.id === userId)
  }

  async function loadAgencyMemberships(userId) {
    if (!userId || !dal?.findAll) return []
    return dal.findAll(
      'agency_members',
      (m) => m.user_id === userId && (m.status === 'active' || m.status == null),
    )
  }

  async function loadAgency(agencyId) {
    if (!agencyId || !dal?.findOne) return null
    return dal.findOne('agencies', (a) => a.id === agencyId)
  }

  async function resolveComparable(report) {
    const data = report.data || {}
    const comparableId = report.comparable_id
    const type = report.comparable_type || data.comparable_type || 'external'
    let record = null

    if (dal?.findOne && comparableId) {
      if (type === 'internal') {
        record = await dal.findOne('properties', (p) => p.id === comparableId)
      } else if (type === 'agent_report') {
        record = await dal.findOne(Collections.AGENT_PRICE_REPORTS, (r) => r.id === comparableId)
      } else {
        record = await dal.findOne(Collections.EXTERNAL_COMPARABLES, (c) => c.id === comparableId)
      }
    }

    const owningAgencyId = record?.agency_id
      || data.comparable_agency_id
      || null
    const agency = owningAgencyId ? await loadAgency(owningAgencyId) : null

    const source = data.comparable_source
      || (type === 'internal' ? 'agency_owned' : type === 'agent_report' ? 'agent_report' : 'external_scrape')

    const sourceDisplay = data.source_display
      || SOURCE_DISPLAY[source]
      || (record?.source_label || record?.source || source)

    const title = data.comparable_title
      || record?.title
      || record?.external_property_title
      || (record?.property_type
        ? `${String(record.property_type)} · ${record.price || record.sold_price || ''}`.trim()
        : comparableId)

    const address = data.address_line
      || record?.location_text
      || record?.external_property_location
      || [record?.neighborhood, record?.city].filter(Boolean).join(', ')
      || null

    const thumb = data.thumb_url
      || record?.thumb_url
      || record?.data?.thumb_url
      || record?.photos?.[0]
      || null

    const scrapedAt = record?.scraped_at || record?.last_seen_at || record?.updated_at
    let scraped_days_ago = null
    if (scrapedAt) {
      scraped_days_ago = Math.max(0, Math.floor(hoursBetween(new Date(scrapedAt), new Date()) / 24))
    }

    const current_fields = {
      price: record?.price ?? record?.sold_price ?? data.current_price ?? null,
      currency: record?.currency || data.currency || 'AED',
      property_type: record?.property_type || data.property_type || null,
      bedrooms: record?.bedrooms ?? null,
      bathrooms: record?.bathrooms ?? null,
      area_sqm: record?.area_sqm ?? record?.area ?? null,
      status: record?.status || 'active',
      last_updated_at: asIso(record?.updated_at || record?.last_seen_at),
      scraped_days_ago,
    }

    return {
      id: comparableId,
      title,
      address_line: address,
      thumb_url: thumb,
      source,
      source_display: typeof sourceDisplay === 'string' ? sourceDisplay : String(sourceDisplay || source),
      source_url: record?.source_url || data.source_url || null,
      owning_agency: agency
        ? {
          id: agency.id,
          name: agency.name,
          tenant_url: `/admin/tenants/${agency.id}`,
        }
        : owningAgencyId
          ? {
            id: owningAgencyId,
            name: data.comparable_agency_name || owningAgencyId,
            tenant_url: `/admin/tenants/${owningAgencyId}`,
          }
          : null,
      owning_agency_id: owningAgencyId,
      current_fields,
      raw: record,
    }
  }

  async function resolveReporter(report, allReportsForPattern = null) {
    const data = report.data || {}
    const user = await loadUser(report.reporter_id)
    const memberships = await loadAgencyMemberships(report.reporter_id)
    const primaryMembership = memberships[0] || null
    const agency = primaryMembership
      ? await loadAgency(primaryMembership.agency_id)
      : (data.reporter_agency_id ? await loadAgency(data.reporter_agency_id) : null)

    const displayName = user?.name
      || data.reporter_name
      || (user?.email ? maskEmail(user.email) : null)
      || report.reporter_id
      || 'Unknown reporter'

    let pattern_flag = Boolean(data.pattern_flag)
    let pattern_signals = data.pattern_signals || null

    if (allReportsForPattern && agency) {
      const windowDays = 30
      const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000
      const againstAgency = allReportsForPattern.filter((r) => {
        if (r.reporter_id !== report.reporter_id) return false
        if (new Date(r.created_at).getTime() < cutoff) return false
        const owning = r._comparable_owning_agency_id
          || r.data?.comparable_agency_id
        return owning && String(owning) === String(agency.id)
      })
      if (againstAgency.length >= 3) {
        pattern_flag = true
        pattern_signals = {
          reports_against_agency_last_30d: againstAgency.length,
          days_window: windowDays,
        }
      }
    }

    return {
      id: report.reporter_id || null,
      display_name: displayName,
      avatar_url: user?.data?.avatar_url || data.avatar_url || null,
      email_masked: user?.email ? maskEmail(user.email) : null,
      agency: agency
        ? {
          id: agency.id,
          name: agency.name,
          tenant_url: `/admin/tenants/${agency.id}`,
        }
        : null,
      pattern_flag,
      pattern_signals,
      agency_ids: memberships.map((m) => m.agency_id),
    }
  }

  function extractEvidence(report) {
    const data = report.data || {}
    const files = data.evidence?.files
      || data.evidence_files
      || (Array.isArray(data.evidence) ? data.evidence : null)
      || []

    const normalized = (files || []).map((f) => {
      if (typeof f === 'string') {
        return {
          filename: f,
          uploaded_at: asIso(report.created_at),
          size_bytes: null,
          content_type: null,
        }
      }
      return {
        filename: f.filename || f.name || f.id || 'evidence',
        uploaded_at: asIso(f.uploaded_at || f.created_at || report.created_at),
        size_bytes: f.size_bytes ?? f.size ?? null,
        content_type: f.content_type || f.mime_type || null,
        url: f.url || null,
      }
    })

    const fileIds = data.evidence_file_ids || []
    if (!normalized.length && fileIds.length) {
      for (const id of fileIds) {
        normalized.push({
          filename: String(id),
          uploaded_at: asIso(report.created_at),
          size_bytes: null,
          content_type: null,
        })
      }
    }

    return {
      file_count: normalized.length,
      files: normalized,
    }
  }

  function extractClaimFields(report, comparable) {
    const data = report.data || {}
    const reported_field = data.reported_field || data.field || null
    const reported_value = data.reported_value ?? comparable?.current_fields?.price ?? null
    const observed_value = data.observed_value ?? data.corrected_value ?? null
    let delta_pct = data.delta_pct
    if (delta_pct == null && Number.isFinite(Number(reported_value)) && Number.isFinite(Number(observed_value)) && Number(reported_value) !== 0) {
      delta_pct = Number((((Number(observed_value) - Number(reported_value)) / Number(reported_value)) * 100).toFixed(1))
    }
    return {
      reported_field,
      reported_value,
      observed_value,
      observed_at: data.observed_at || null,
      reason_text: data.reason_text || report.notes || null,
      delta_pct: delta_pct == null ? null : Number(delta_pct),
      field_diffs: data.field_diffs || (
        reported_field
          ? [{ field: reported_field, current: reported_value, observed: observed_value }]
          : []
      ),
    }
  }

  async function detectIsOwn(viewerId, report, reporter, comparable) {
    if (!viewerId) return false
    if (report.reporter_id && String(report.reporter_id) === String(viewerId)) return true

    const viewerMemberships = await loadAgencyMemberships(viewerId)
    const viewerAgencyIds = new Set(viewerMemberships.map((m) => String(m.agency_id)))

    if (comparable?.owning_agency_id && viewerAgencyIds.has(String(comparable.owning_agency_id))) {
      return true
    }
    if (reporter?.agency?.id && viewerAgencyIds.has(String(reporter.agency.id)) && report.reporter_id === viewerId) {
      return true
    }
    return false
  }

  function reportEnv(report) {
    return normalizeClientEnv(report.data?.env || report.env || 'live')
  }

  function slaFor(report, now = new Date()) {
    const total = Number(report.data?.sla_hours_total) || slaHours
    const created = new Date(report.created_at || now)
    const elapsed = hoursBetween(created, now)
    const remaining = Number((total - elapsed).toFixed(1))
    return {
      sla_hours_total: Number(total.toFixed(1)),
      sla_hours_remaining: remaining,
    }
  }

  async function hydrateReport(report, {
    viewerId,
    env,
    allReports = null,
    includeDetail = false,
    impactCache = null,
  } = {}) {
    const data = report.data || {}
    const comparable = await resolveComparable(report)
    if (allReports) {
      report._comparable_owning_agency_id = comparable.owning_agency_id
    }
    const reporter = await resolveReporter(report, allReports)
    const claim = extractClaimFields(report, comparable)
    const evidence = extractEvidence(report)

    const cacheKey = `${report.comparable_id}:${report.comparable_type || ''}`
    let impact
    if (impactCache?.has(cacheKey)) {
      impact = impactCache.get(cacheKey)
    } else {
      impact = await impactService.scoreComparableImpact({
        comparableId: report.comparable_id,
        comparableType: report.comparable_type || null,
      })
      impactCache?.set(cacheKey, impact)
    }

    const reason_category = normalizeReasonCategory(report.reason, data)
    const status = normalizeReportStatus(report.status)
    const severity = deriveSeverity({
      reasonCategory: reason_category,
      deltaPct: claim.delta_pct,
      data,
      marketImpactTier: impact.tier,
    })
    const sla = slaFor(report)
    const is_own = await detectIsOwn(viewerId, report, reporter, comparable)
    const requires_two_person = impact.tier === MARKET_IMPACT_TIERS.HIGH

    const base = {
      id: report.id,
      created_at: asIso(report.created_at),
      sla_hours_remaining: sla.sla_hours_remaining,
      sla_hours_total: sla.sla_hours_total,
      status,
      reason_category,
      severity,
      reporter: {
        id: reporter.id,
        display_name: reporter.display_name,
        avatar_url: reporter.avatar_url,
        agency: reporter.agency,
        pattern_flag: reporter.pattern_flag,
        pattern_signals: reporter.pattern_signals,
      },
      comparable: {
        id: comparable.id,
        title: comparable.title,
        address_line: comparable.address_line,
        thumb_url: comparable.thumb_url,
        source: comparable.source,
        source_display: comparable.source_display,
        owning_agency: comparable.owning_agency,
        ...(includeDetail
          ? {
            source_url: comparable.source_url,
            current_fields: comparable.current_fields,
          }
          : {}),
      },
      reported_field: claim.reported_field,
      reported_value: claim.reported_value,
      observed_value: claim.observed_value,
      delta_pct: claim.delta_pct,
      market_impact: {
        tier: impact.tier,
        valuations_affected: impact.valuations_affected,
        pct_move_median: impact.pct_move_median,
        pct_move_max: impact.pct_move_max,
        ...(includeDetail ? { top_markets: impact.top_markets || [] } : {}),
      },
      evidence,
      is_own,
      requires_two_person,
      env: env || reportEnv(report),
      // Internal helpers for filters/counts/csv (stripped before response if needed)
      _decided_at: asIso(report.reviewed_at || data.decided_at),
      _decided_by: report.reviewed_by || data.decided_by || null,
      _decision_reason: data.decision_reason || null,
      _decision_notes: report.notes || data.decision_notes || null,
      _legacy_status: report.status,
    }

    if (!includeDetail) return base

    // Detail-only blocks [BE-CMR-11]
    const related = (allReports || [])
      .filter((r) => r.id !== report.id && r.comparable_id === report.comparable_id)
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        reporter: r.reporter_id,
        reason_category: normalizeReasonCategory(r.reason, r.data || {}),
        status: normalizeReportStatus(r.status),
        decided_at: asIso(r.reviewed_at || r.data?.decided_at),
      }))

    return {
      ...base,
      reporter_claim: {
        reported_field: claim.reported_field,
        observed_value: claim.observed_value,
        observed_at: claim.observed_at,
        reason_text: claim.reason_text,
        field_diffs: claim.field_diffs,
      },
      related_reports: related,
    }
  }

  function stripInternal(row) {
    const {
      _decided_at,
      _decided_by,
      _decision_reason,
      _decision_notes,
      _legacy_status,
      ...publicRow
    } = row
    return publicRow
  }

  function matchesFilters(row, {
    status,
    category,
    severity,
    impact,
    withinMs,
    q,
    env,
    now,
  }) {
    if (env && row.env !== env) return false
    if (status && status !== 'all' && row.status !== status) return false
    if (category && category !== 'all' && row.reason_category !== category) return false
    if (severity && severity !== 'all' && row.severity !== severity) return false
    if (impact && impact !== 'all' && row.market_impact?.tier !== impact) return false
    if (withinMs != null) {
      const created = new Date(row.created_at).getTime()
      if (Number.isNaN(created) || now.getTime() - created > withinMs) return false
    }
    if (q) {
      const needle = String(q).trim().toLowerCase()
      if (needle) {
        const hay = [
          row.id,
          row.reporter?.display_name,
          row.reporter?.agency?.name,
          row.comparable?.id,
          row.comparable?.title,
          row.comparable?.address_line,
          row.reason_category,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(needle)) return false
      }
    }
    return true
  }

  function buildCounts(hydrated, now = new Date()) {
    const weekStart = startOfWeek(now).getTime()
    const counts = {
      pending: 0,
      pending_at_risk: 0,
      high_impact_awaiting_two_person: 0,
      confirmed_removed_this_week: 0,
      confirmed_quarantined_this_week: 0,
      rejected_this_week: 0,
      awaiting_info_this_week: 0,
      expired_this_week: 0,
    }

    for (const row of hydrated) {
      if (row.status === 'pending') {
        counts.pending += 1
        if (row.sla_hours_remaining <= 6) counts.pending_at_risk += 1
        if (row.requires_two_person || row.market_impact?.tier === 'high') {
          counts.high_impact_awaiting_two_person += 1
        }
      }
      const decidedAt = row._decided_at ? new Date(row._decided_at).getTime() : null
      const createdAt = new Date(row.created_at).getTime()
      const inWeek = (decidedAt != null ? decidedAt : createdAt) >= weekStart
      if (!inWeek) continue
      if (row.status === 'confirmed_removed') counts.confirmed_removed_this_week += 1
      if (row.status === 'confirmed_quarantined') counts.confirmed_quarantined_this_week += 1
      if (row.status === 'rejected') counts.rejected_this_week += 1
      if (row.status === 'awaiting_info') counts.awaiting_info_this_week += 1
      if (row.status === 'expired') counts.expired_this_week += 1
    }
    return counts
  }

  async function listReports(query = {}, { viewerId, req } = {}) {
    const now = new Date()
    const env = resolveSessionEnv(req || { get: () => query.env, user: { id: viewerId, env: query.env } })
    const page = parsePage(query.page)
    const pageSize = parsePageSize(query.pageSize || query.page_size)
    const withinMs = parseWithin(query.within)
    const sortSpec = parseSort(query.sort)

    const rawReports = await dal.findAll(Collections.COMPARABLE_REPORTS, () => true)
    const impactCache = new Map()

    // First pass hydrate for env-scoped universe (for counts)
    const hydratedAll = []
    for (const report of rawReports) {
      if (reportEnv(report) !== env) continue
      const row = await hydrateReport(report, {
        viewerId,
        env,
        allReports: rawReports,
        impactCache,
      })
      hydratedAll.push(row)
    }

    const counts = buildCounts(hydratedAll, now)

    const filtered = hydratedAll.filter((row) => matchesFilters(row, {
      status: query.status,
      category: query.category,
      severity: query.severity,
      impact: query.impact,
      withinMs,
      q: query.q,
      env,
      now,
    }))

    filtered.sort((a, b) => compareBySort(a, b, sortSpec))

    const total = filtered.length
    const start = (page - 1) * pageSize
    const pageRows = filtered.slice(start, start + pageSize).map(stripInternal)

    return {
      reports: pageRows,
      pagination: {
        page,
        page_size: pageSize,
        total,
        has_next: start + pageSize < total,
      },
      counts,
      env,
    }
  }

  async function getReport(reportId, { viewerId, req } = {}) {
    const env = resolveSessionEnv(req || { get: () => null, user: { id: viewerId } })
    const report = await dal.findOne(Collections.COMPARABLE_REPORTS, (r) => r.id === reportId)
    if (!report) return null
    if (reportEnv(report) !== env) return null

    const allReports = await dal.findAll(Collections.COMPARABLE_REPORTS, () => true)
    const hydrated = await hydrateReport(report, {
      viewerId,
      env,
      allReports,
      includeDetail: true,
    })
    return stripInternal(hydrated)
  }

  async function getReporterHistory(reportId, { limit = 10, viewerId, req } = {}) {
    const env = resolveSessionEnv(req || { get: () => null, user: { id: viewerId } })
    const report = await dal.findOne(Collections.COMPARABLE_REPORTS, (r) => r.id === reportId)
    if (!report) return null
    if (reportEnv(report) !== env) return null

    const lim = Math.min(Math.max(Number.parseInt(String(limit), 10) || 10, 1), 50)
    const all = await dal.findAll(
      Collections.COMPARABLE_REPORTS,
      (r) => r.reporter_id === report.reporter_id,
    )
    const sorted = [...(all || [])].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    )

    const reports = sorted.slice(0, lim).map((r) => ({
      id: r.id,
      comparable_id: r.comparable_id,
      reason_category: normalizeReasonCategory(r.reason, r.data || {}),
      status: normalizeReportStatus(r.status),
      created_at: asIso(r.created_at),
      decided_at: asIso(r.reviewed_at || r.data?.decided_at),
      decided_by: r.reviewed_by || r.data?.decided_by || null,
      outcome_summary: r.notes || r.data?.decision_notes || null,
      is_current: r.id === reportId,
    }))

    return {
      reporter_id: report.reporter_id,
      limit: lim,
      reports,
      env,
    }
  }

  async function getAuditTrail(reportId, { viewerId, req } = {}) {
    const env = resolveSessionEnv(req || { get: () => null, user: { id: viewerId } })
    const report = await dal.findOne(Collections.COMPARABLE_REPORTS, (r) => r.id === reportId)
    if (!report) return null
    if (reportEnv(report) !== env) return null

    const events = []

    events.push({
      id: `${report.id}:submitted`,
      at: asIso(report.created_at),
      actor_id: report.reporter_id,
      action: 'report.submitted',
      summary: 'Comparable report submitted',
      metadata: {
        reason: report.reason,
        comparable_id: report.comparable_id,
        status: normalizeReportStatus(report.status),
      },
    })

    if (report.reviewed_at || report.reviewed_by) {
      events.push({
        id: `${report.id}:decided`,
        at: asIso(report.reviewed_at || report.updated_at),
        actor_id: report.reviewed_by,
        action: 'report.decided',
        summary: `Report marked ${normalizeReportStatus(report.status)}`,
        metadata: {
          status: normalizeReportStatus(report.status),
          notes: report.notes || null,
          legacy_status: report.status,
        },
      })
    }

    // Reuse PA-AUD-001 style audit_log rows when present.
    if (dal?.findAll) {
      try {
        const auditRows = await dal.findAll(
          'audit_log',
          (row) => (
            (row.entity_type === 'comparable_report' || row.entity_type === 'comparable_reports')
            && String(row.entity_id) === String(reportId)
          ),
        )
        for (const row of auditRows || []) {
          events.push({
            id: row.id || `${reportId}:audit:${row.created_at}`,
            at: asIso(row.created_at),
            actor_id: row.agent_id || row.actor_id || null,
            action: row.action || row.type || 'audit.event',
            summary: row.metadata?.summary || row.type || row.action || 'Audit event',
            metadata: row.metadata || {},
          })
        }
      } catch (err) {
        logger?.debug?.({ err: err.message }, 'audit_log read skipped')
      }
    }

    // Resolve actor display names (masked-safe).
    const actorIds = [...new Set(events.map((e) => e.actor_id).filter(Boolean))]
    const actorNames = new Map()
    for (const id of actorIds) {
      const user = await loadUser(id)
      actorNames.set(id, user?.name || (user?.email ? maskEmail(user.email) : id))
    }

    events.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0))

    return {
      report_id: reportId,
      events: events.map((e) => ({
        ...e,
        actor_name: e.actor_id ? actorNames.get(e.actor_id) || null : null,
      })),
      env,
    }
  }

  function toCsvValue(value) {
    if (value == null) return ''
    const s = String(value)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  async function exportCsv(query = {}, ctx = {}) {
    const all = []
    let page = 1
    let env = 'live'
    let total = Infinity
    while (all.length < total && page <= 1000) {
      const listed = await listReports({ ...query, page, pageSize: MAX_PAGE_SIZE }, ctx)
      env = listed.env
      total = listed.pagination.total
      all.push(...listed.reports)
      if (!listed.pagination.has_next) break
      page += 1
    }

    const raw = await dal.findAll(Collections.COMPARABLE_REPORTS, () => true)
    const byId = new Map((raw || []).map((r) => [r.id, r]))

    const headers = [
      'report_id', 'submitted_at', 'reporter_name', 'reporter_agency',
      'comparable_id', 'comparable_title', 'comparable_source', 'comparable_agency',
      'reason_category', 'severity', 'market_impact_tier', 'valuations_affected',
      'valuations_pct_move_median', 'evidence_count', 'status',
      'decided_at', 'decided_by', 'decision_reason', 'decision_notes',
    ]

    const lines = [headers.join(',')]
    for (const row of all) {
      const source = byId.get(row.id) || {}
      lines.push([
        row.id,
        row.created_at,
        row.reporter?.display_name,
        row.reporter?.agency?.name,
        row.comparable?.id,
        row.comparable?.title,
        row.comparable?.source,
        row.comparable?.owning_agency?.name,
        row.reason_category,
        row.severity,
        row.market_impact?.tier,
        row.market_impact?.valuations_affected,
        row.market_impact?.pct_move_median,
        row.evidence?.file_count,
        row.status,
        asIso(source.reviewed_at || source.data?.decided_at),
        source.reviewed_by || source.data?.decided_by || '',
        source.data?.decision_reason || '',
        source.notes || source.data?.decision_notes || '',
      ].map(toCsvValue).join(','))
    }

    return {
      csv: `${lines.join('\n')}\n`,
      env,
      filename: `comparable-reports-${env}.csv`,
    }
  }

  return {
    listReports,
    getReport,
    getReporterHistory,
    getAuditTrail,
    exportCsv,
    normalizeReportStatus,
    normalizeReasonCategory,
    deriveSeverity,
  }
}
