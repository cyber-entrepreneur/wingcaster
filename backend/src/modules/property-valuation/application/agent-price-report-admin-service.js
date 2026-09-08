/**
 * WF-06 PA-PVA-009 agent price report admin service.
 *
 * List / detail / review (incorporate) / bulk / undo / CSV.
 * Incorporate is transactional: benchmark write rolls back if status write fails.
 */

import { createHash, randomUUID } from 'crypto'
import { scoreTenureRisk } from '../../../lib/moderation/tenure-risk.js'
import { normalizeClientEnv } from '../../../lib/session-env.js'
import { Collections } from '../infrastructure/db.js'
import {
  HIGH_DELTA_THRESHOLD_PCT,
  PRICE_REPORT_INCORPORATE_ACTION,
  countryFlagEmoji,
  compositeRiskTier,
  matchesDeltaBucket,
  resolveRecommendation,
  resolveSegmentId,
  resolveSegmentLabel,
} from './benchmark-service.js'

const REVIEW_STATUSES = new Set(['verified', 'rejected', 'request_info'])
const UNDO_GRACE_MS = 5000
const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

const STATUS_ALIASES = Object.freeze({
  pending: 'pending_review',
})

export function normalizeReportStatus(status) {
  const raw = String(status || '').trim()
  return STATUS_ALIASES[raw] || raw
}

export function createAgentPriceReportAdminService({
  dal,
  benchmarkService,
  adapter = null,
  logger = console,
}) {
  async function listReports(query = {}, { viewerId = null, env: envInput = 'live' } = {}) {
    const env = normalizeClientEnv(envInput)
    const page = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize || query.page_size) || DEFAULT_PAGE_SIZE))
    const sort = String(query.sort || 'delta_abs:desc')
    const statusFilter = query.status ? normalizeReportStatus(query.status) : null

    const all = await dal.findAll(Collections.AGENT_PRICE_REPORTS, (row) => (row.env || 'live') === env)
    const enriched = []
    for (const report of all) {
      enriched.push(await enrichReport(report, { viewerId, env, detail: false }))
    }

    let filtered = enriched.filter((row) => {
      if (statusFilter === 'verified') {
        if (!['verified', 'incorporated'].includes(row.status)) return false
      } else if (statusFilter === 'incorporated') {
        if (row.status !== 'incorporated') return false
      } else if (statusFilter) {
        if (row.status !== statusFilter) return false
      }
      if (query.country && String(row.subject?.country_code || '').toUpperCase() !== String(query.country).toUpperCase()) return false
      if (query.segment && row.subject?.segment_id !== query.segment && !String(row.subject?.segment_label || '').toLowerCase().includes(String(query.segment).toLowerCase())) return false
      if (query.tier && row.agent?.tier !== query.tier) return false
      if (query.delta && !matchesDeltaBucket(row.benchmark_delta?.delta_pct, query.delta)) return false
      if (query.within && query.within !== 'all' && !withinWindow(row.submitted_at, query.within)) return false
      if (query.q) {
        const q = String(query.q).toLowerCase()
        const hay = [
          row.agent?.display_name,
          row.agency?.name,
          row.subject?.segment_label,
          row.subject?.segment_id,
          row.id,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    filtered = sortReports(filtered, sort)

    const total = filtered.length
    const start = (page - 1) * pageSize
    const reports = filtered.slice(start, start + pageSize)
    const counts = computeCounts(enriched)

    return {
      reports,
      pagination: {
        page,
        page_size: pageSize,
        total,
        has_next: start + pageSize < total,
      },
      counts,
    }
  }

  async function getReport(reportId, { viewerId = null, env: envInput = 'live' } = {}) {
    const env = normalizeClientEnv(envInput)
    const report = await dal.findOne(
      Collections.AGENT_PRICE_REPORTS,
      (row) => row.id === reportId && (row.env || 'live') === env,
    )
    if (!report) return null
    return enrichReport(report, { viewerId, env, detail: true })
  }

  async function reviewReport(reportId, body, { viewerId, env: envInput = 'live', viewerIsUuid = null } = {}) {
    const env = normalizeClientEnv(envInput)
    const status = String(body?.status || '').trim()
    if (!REVIEW_STATUSES.has(status)) {
      const err = new Error("status must be 'verified', 'rejected', or 'request_info'")
      err.status = 400
      err.code = 'INVALID_STATUS'
      throw err
    }

    const incorporate = Boolean(body?.incorporate)
    if (incorporate && status !== 'verified') {
      const err = new Error('incorporate is only valid when status is verified')
      err.status = 400
      err.code = 'INVALID_INCORPORATE'
      throw err
    }

    if ((status === 'rejected' || status === 'request_info') && !body?.reason_code && !body?.notes) {
      // reason_code preferred; notes alone still accepted for backwards compat
    }

    const existing = await dal.findOne(
      Collections.AGENT_PRICE_REPORTS,
      (row) => row.id === reportId && (row.env || 'live') === env,
    )
    if (!existing) {
      const err = new Error('Report not found')
      err.status = 404
      err.code = 'NOT_FOUND'
      throw err
    }

    if (existing.reporter_id && viewerId && existing.reporter_id === viewerId) {
      const err = new Error('Cannot review your own price report')
      err.status = 403
      err.code = 'OWN_REPORT'
      throw err
    }

    const normalizedStatus = normalizeReportStatus(existing.status)
    if (!['pending_review', 'request_info', 'pending_second_approval'].includes(normalizedStatus)
      && !(normalizedStatus === 'pending')) {
      // Allow re-review only from actionable states
      if (!['pending_review', 'request_info'].includes(normalizedStatus)) {
        const err = new Error(`Report cannot be reviewed from status ${normalizedStatus}`)
        err.status = 409
        err.code = 'INVALID_STATE'
        throw err
      }
    }

    const delta = await benchmarkService.computeBenchmarkDelta(existing, env)
    const absDelta = Math.abs(Number(delta.delta_pct) || 0)
    const now = new Date().toISOString()

    // High-delta incorporate → two-person via fin.approval_requests (no benchmark write yet)
    if (incorporate && absDelta >= HIGH_DELTA_THRESHOLD_PCT) {
      const approval = await createIncorporateApprovalRequest({
        report: existing,
        delta,
        viewerId,
        viewerIsUuid,
        env,
        notes: body?.notes || null,
        now,
      })
      await dal.update(Collections.AGENT_PRICE_REPORTS, (r) => r.id === reportId, (r) => ({
        ...r,
        status: 'pending_second_approval',
        review_notes: body?.notes !== undefined ? body.notes : r.review_notes,
        reason_code: body?.reason_code || r.reason_code || null,
        reviewed_by: viewerId,
        reviewed_at: now,
        approval_request_id: approval.id,
        updated_at: now,
        data: {
          ...(r.data || {}),
          pending_incorporate: true,
          pending_delta_pct: delta.delta_pct,
          approval_request_id: approval.id,
        },
      }))
      return {
        success: true,
        pending_second_approval: true,
        request_id: approval.id,
        approval_request_id: approval.id,
        status: 'pending_second_approval',
      }
    }

    if (incorporate) {
      return commitIncorporate({
        report: existing,
        delta,
        viewerId,
        env,
        notes: body?.notes,
        reasonCode: body?.reason_code,
        now,
      })
    }

    const nextStatus = status === 'verified' ? 'verified' : status
    await dal.update(Collections.AGENT_PRICE_REPORTS, (r) => r.id === reportId, (r) => ({
      ...r,
      status: nextStatus,
      incorporated: false,
      review_notes: body?.notes !== undefined ? body.notes : r.review_notes,
      reason_code: body?.reason_code || r.reason_code || null,
      reviewed_by: viewerId,
      reviewed_at: now,
      updated_at: now,
      data: {
        ...(r.data || {}),
        decision: nextStatus,
        decision_notes: body?.notes || null,
        decision_reason: body?.reason_code || null,
      },
    }))

    return { success: true, status: nextStatus, incorporated: false }
  }

  async function commitIncorporate({ report, delta, viewerId, env, notes, reasonCode, now }) {
    const reportId = report.id
    let refreshJob = null

    const result = await dal.transaction(async () => {
      // Benchmark write first; if status update throws, transaction rolls both back.
      const benchmark = await benchmarkService.writeBenchmarkFromReport(report, { env, actorId: viewerId })

      await dal.update(Collections.AGENT_PRICE_REPORTS, (r) => r.id === reportId, (r) => {
        // Force a failure surface for tests that inject throw-after-write via data flag
        if (r.data?.__force_status_write_failure) {
          throw Object.assign(new Error('Forced status write failure'), { status: 500, code: 'STATUS_WRITE_FAILED' })
        }
        return {
          ...r,
          status: 'incorporated',
          incorporated: true,
          incorporated_at: now,
          review_notes: notes !== undefined ? notes : r.review_notes,
          reason_code: reasonCode || r.reason_code || null,
          reviewed_by: viewerId,
          reviewed_at: now,
          updated_at: now,
          data: {
            ...(r.data || {}),
            decision: 'incorporated',
            decision_notes: notes || null,
            benchmark_id: benchmark.id,
            incorporated_delta_pct: delta?.delta_pct ?? null,
          },
        }
      })

      return { benchmark }
    })

    refreshJob = await benchmarkService.enqueueBenchmarkRefresh({
      segmentId: resolveSegmentId(report),
      propertyType: report.property_type || null,
      requestedBy: viewerId,
    })

    return {
      success: true,
      status: 'incorporated',
      incorporated: true,
      benchmark_id: result.benchmark?.id || null,
      benchmark_refresh_queued: Boolean(refreshJob),
      refresh_job_id: refreshJob?.id || null,
    }
  }

  async function createIncorporateApprovalRequest({ report, delta, viewerId, viewerIsUuid, env, notes, now }) {
    const approvalId = randomUUID()
    const payload = {
      workflow: 'wf06_price_report_incorporate',
      report_id: report.id,
      segment_id: resolveSegmentId(report),
      delta_pct: delta.delta_pct,
      recommendation: resolveRecommendation(report),
      notes,
      env,
    }
    const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
    const actorUuid = coerceUuid(viewerIsUuid || viewerId)

    // Prefer raw SQL when dal.query is available (Postgres). Fall back to insert collection if mapped.
    if (typeof dal.query === 'function') {
      await dal.query(
        `INSERT INTO fin.approval_requests (
           id, environment, tenant_id, action_kind, status, subject_type, subject_id,
           payload_hash, payload, min_distinct_approvers,
           created_at, created_by_actor_type, created_by_actor_id, updated_at
         ) VALUES (
           $1::uuid, $2, NULL, $3, 'REQUESTED', 'agent_price_report', NULL,
           $4, $5::jsonb, 2,
           $6::timestamptz, 'USER', $7, $6::timestamptz
         )`,
        [
          approvalId,
          env === 'test' ? 'TEST' : 'LIVE',
          PRICE_REPORT_INCORPORATE_ACTION,
          payloadHash,
          JSON.stringify(payload),
          now,
          actorUuid,
        ],
      )
      return { id: approvalId, payload }
    }

    // In-memory / test DAL path
    if (dal.insert) {
      await dal.insert('approval_requests', {
        id: approvalId,
        environment: env === 'test' ? 'TEST' : 'LIVE',
        action_kind: PRICE_REPORT_INCORPORATE_ACTION,
        status: 'REQUESTED',
        subject_type: 'agent_price_report',
        payload_hash: payloadHash,
        payload,
        min_distinct_approvers: 2,
        created_at: now,
        created_by_actor_id: actorUuid,
        updated_at: now,
      })
    }
    return { id: approvalId, payload }
  }

  async function bulkReview(body, { viewerId, env: envInput = 'live' } = {}) {
    const env = normalizeClientEnv(envInput)
    const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : []
    if (ids.length === 0) {
      const err = new Error('ids is required')
      err.status = 400
      err.code = 'INVALID_INPUT'
      throw err
    }
    if (body?.incorporate === true) {
      const err = new Error('Bulk incorporate is disallowed; review each report individually')
      err.status = 400
      err.code = 'BULK_INCORPORATE_DISALLOWED'
      throw err
    }
    const status = String(body?.status || '').trim()
    if (!REVIEW_STATUSES.has(status)) {
      const err = new Error("status must be 'verified', 'rejected', or 'request_info'")
      err.status = 400
      err.code = 'INVALID_STATUS'
      throw err
    }

    const results = []
    for (const id of ids) {
      try {
        const outcome = await reviewReport(id, {
          status,
          incorporate: false,
          reason_code: body?.reason_code,
          notes: body?.notes,
        }, { viewerId, env })
        results.push({ id, ok: true, ...outcome })
      } catch (err) {
        results.push({ id, ok: false, error: err.code || err.message, status: err.status || 500 })
      }
    }
    return { success: true, results }
  }

  async function undoReview(reportId, { viewerId, env: envInput = 'live' } = {}) {
    const env = normalizeClientEnv(envInput)
    const report = await dal.findOne(
      Collections.AGENT_PRICE_REPORTS,
      (row) => row.id === reportId && (row.env || 'live') === env,
    )
    if (!report) {
      const err = new Error('Report not found')
      err.status = 404
      err.code = 'NOT_FOUND'
      throw err
    }
    if (!report.reviewed_at) {
      const err = new Error('Report has no review to undo')
      err.status = 409
      err.code = 'NO_REVIEW'
      throw err
    }
    if (report.reviewed_by && viewerId && report.reviewed_by !== viewerId) {
      const err = new Error('Only the reviewing PA can undo within the grace window')
      err.status = 403
      err.code = 'FORBIDDEN'
      throw err
    }
    const age = Date.now() - new Date(report.reviewed_at).getTime()
    if (age > UNDO_GRACE_MS) {
      const err = new Error('Undo grace window expired')
      err.status = 409
      err.code = 'UNDO_EXPIRED'
      throw err
    }

    const wasIncorporated = report.status === 'incorporated' || report.incorporated === true
    await dal.transaction(async () => {
      if (wasIncorporated) {
        await benchmarkService.rollbackBenchmarkWrite(report, { env })
      }
      const now = new Date().toISOString()
      await dal.update(Collections.AGENT_PRICE_REPORTS, (r) => r.id === reportId, (r) => ({
        ...r,
        status: 'pending_review',
        incorporated: false,
        incorporated_at: null,
        reviewed_by: null,
        reviewed_at: null,
        review_notes: null,
        reason_code: null,
        approval_request_id: null,
        updated_at: now,
        data: {
          ...(r.data || {}),
          undone_at: now,
          undone_by: viewerId,
          prior_status: r.status,
        },
      }))
    })

    return { success: true, status: 'pending_review', rolled_back_benchmark: wasIncorporated }
  }

  async function exportCsv(query = {}, opts = {}) {
    const { reports } = await listReports({ ...query, page: 1, pageSize: MAX_PAGE_SIZE }, opts)
    const header = [
      'report_id', 'submitted_at', 'agent', 'agency', 'tier', 'tenure_days',
      'segment', 'country', 'recommendation', 'currency', 'benchmark', 'delta_pct',
      'composite_risk', 'status', 'decided_at', 'decided_by', 'decision_reason', 'decision_notes',
    ]
    const lines = [header.join(',')]
    for (const row of reports) {
      lines.push([
        csv(row.id),
        csv(row.submitted_at),
        csv(row.agent?.display_name),
        csv(row.agency?.name),
        csv(row.agent?.tier),
        csv(row.agent?.tenure_days),
        csv(row.subject?.segment_label),
        csv(row.subject?.country_code),
        csv(row.recommendation?.price_point),
        csv(row.recommendation?.currency),
        csv(row.benchmark_delta?.benchmark_price_point),
        csv(row.benchmark_delta?.delta_pct),
        csv(row.composite_risk_tier),
        csv(row.status),
        csv(row.review?.decided_at),
        csv(row.review?.decided_by),
        csv(row.review?.reason_code),
        csv(row.review?.notes),
      ].join(','))
    }
    return lines.join('\n')
  }

  async function enrichReport(report, { viewerId, env, detail }) {
    const status = normalizeReportStatus(report.status)
    const recommendation = resolveRecommendation(report)
    const segmentId = resolveSegmentId(report)
    const segmentLabel = resolveSegmentLabel(report)
    const countryCode = report.country_code || report.data?.country_code || null
    const benchmarkDelta = await benchmarkService.computeBenchmarkDelta(report, env)

    const agent = await resolveAgent(report)
    const agency = await resolveAgency(report, agent)
    const tenureRisk = scoreTenureRisk({ agent, submission: report, agency }) || {
      tier: 'unknown', score: null, signals: [], version: 'v1-stub',
    }
    // Align stub shape to brief when scoreTenureRisk returns only {tier}
    const tenure = {
      tier: tenureRisk.tier || 'unknown',
      score: tenureRisk.score ?? null,
      signals: tenureRisk.signals || [],
    }

    const composite = compositeRiskTier({
      deltaPct: benchmarkDelta.delta_pct,
      tenureTier: tenure.tier,
    })
    const absDelta = Math.abs(Number(benchmarkDelta.delta_pct) || 0)
    const twoPersonRequired = absDelta >= HIGH_DELTA_THRESHOLD_PCT
    const isOwn = Boolean(viewerId && report.reporter_id === viewerId)

    const base = {
      id: report.id,
      submitted_at: report.created_at || report.submitted_at || null,
      agent,
      agency,
      subject: {
        segment_label: segmentLabel,
        segment_id: segmentId,
        country_code: countryCode,
        country_flag_emoji: countryFlagEmoji(countryCode),
        comparable_listings_count: Number(report.data?.comparable_listings_count) || 0,
        ...(detail ? {
          property_type: report.property_type || report.data?.property_type || null,
          bedroom_range: report.data?.bedroom_range
            || (report.bedrooms != null ? String(report.bedrooms) : null),
        } : {}),
      },
      recommendation,
      benchmark_delta: {
        benchmark_price_point: benchmarkDelta.benchmark_price_point,
        benchmark_currency: benchmarkDelta.benchmark_currency,
        delta_pct: benchmarkDelta.delta_pct,
        delta_direction: benchmarkDelta.delta_direction,
        delta_tier: benchmarkDelta.delta_tier,
        benchmark_computed_at: benchmarkDelta.benchmark_computed_at,
        stale: benchmarkDelta.stale,
      },
      sources: {
        comparable_count: Array.isArray(report.data?.cited_comparable_ids)
          ? report.data.cited_comparable_ids.length
          : Number(report.data?.comparable_count) || 0,
        evidence_file_count: Array.isArray(report.data?.evidence_files)
          ? report.data.evidence_files.length
          : (report.supporting_document_url ? 1 : Number(report.data?.evidence_file_count) || 0),
      },
      tenure_risk: tenure,
      composite_risk_tier: composite,
      status,
      review: report.reviewed_at ? {
        decided_at: report.reviewed_at,
        decided_by: report.reviewed_by,
        reason_code: report.reason_code || null,
        notes: report.review_notes || null,
        incorporated: Boolean(report.incorporated || status === 'incorporated'),
      } : null,
      is_own: isOwn,
      step_up_required: twoPersonRequired || composite === 'high',
      two_person_required: twoPersonRequired,
      env,
      approval_request_id: report.approval_request_id || report.data?.approval_request_id || null,
    }

    if (!detail) return base

    return {
      ...base,
      parameters: report.data?.parameters || {
        segment_definition: segmentLabel,
        time_window: report.data?.time_window || null,
        analysis_basis: report.data?.analysis_basis || null,
        recommendation_type: recommendation.price_low != null ? 'band' : 'point',
      },
      analysis: report.data?.analysis || {
        format: 'markdown',
        body: report.notes || report.data?.analysis_markdown || null,
      },
      cited_comparables: report.data?.cited_comparables || [],
      evidence_files: report.data?.evidence_files || (report.supporting_document_url ? [{
        id: 'ev_legacy',
        filename: 'supporting-document',
        mime: 'application/octet-stream',
        size_bytes: null,
        uploaded_at: report.created_at,
        url: report.supporting_document_url,
      }] : []),
      audit_trail: buildAuditTrail(report, agent),
      resubmit_of: report.resubmit_of || null,
    }
  }

  async function resolveAgent(report) {
    const dataAgent = report.data?.agent
    if (dataAgent?.id) {
      return {
        id: dataAgent.id,
        display_name: dataAgent.display_name || dataAgent.name || 'Agent',
        avatar_url: dataAgent.avatar_url || null,
        tier: dataAgent.tier || 'pro',
        tenure_days: dataAgent.tenure_days ?? null,
      }
    }

    let user = null
    let agentRow = null
    try {
      if (report.reporter_id) {
        user = await dal.findOne('users', (u) => u.id === report.reporter_id)
      }
      if (report.agent_id) {
        agentRow = await dal.findOne('agents', (a) => a.id === report.agent_id || a.user_id === report.agent_id)
      }
      if (!agentRow && report.reporter_id) {
        agentRow = await dal.findOne('agents', (a) => a.user_id === report.reporter_id || a.id === report.reporter_id)
      }
    } catch (err) {
      logger?.warn?.({ err: err.message, reportId: report.id }, 'Failed to join agent for price report')
    }

    const createdAt = agentRow?.created_at || user?.created_at
    const tenureDays = createdAt
      ? Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000)))
      : null

    return {
      id: report.reporter_id || report.agent_id || null,
      display_name: user?.name || user?.email || agentRow?.name || 'Unknown agent',
      avatar_url: user?.avatar_url || agentRow?.avatar_url || null,
      tier: agentRow?.subscription_tier || user?.tier || report.data?.tier || 'pro',
      tenure_days: tenureDays,
    }
  }

  async function resolveAgency(report, agent) {
    const dataAgency = report.data?.agency
    if (dataAgency?.id) {
      return {
        id: dataAgency.id,
        name: dataAgency.name || 'Agency',
        tenant_url: dataAgency.tenant_url || `/admin/tenants/${dataAgency.id}`,
      }
    }
    try {
      let agencyId = report.data?.agency_id || null
      if (!agencyId && agent?.id) {
        const agentRow = await dal.findOne('agents', (a) => a.id === agent.id || a.user_id === agent.id)
        agencyId = agentRow?.agency_id || null
      }
      if (!agencyId) return null
      const agency = await dal.findOne('agencies', (a) => a.id === agencyId)
      if (!agency) {
        return { id: agencyId, name: 'Agency', tenant_url: `/admin/tenants/${agencyId}` }
      }
      return {
        id: agency.id,
        name: agency.name || 'Agency',
        tenant_url: `/admin/tenants/${agency.id}`,
      }
    } catch {
      return null
    }
  }

  function buildAuditTrail(report, agent) {
    const trail = []
    trail.push({
      actor: { id: report.reporter_id, name: agent?.display_name || 'Agent', role: 'agent' },
      action: 'submitted',
      at: report.created_at,
      reason: null,
      notes: null,
    })
    if (report.reviewed_at) {
      trail.push({
        actor: { id: report.reviewed_by, name: null, role: 'platform_admin' },
        action: report.status === 'incorporated' ? 'incorporated'
          : report.status === 'request_info' ? 'request_info'
            : report.status === 'pending_second_approval' ? 'requested_second_approval'
              : report.status,
        at: report.reviewed_at,
        reason: report.reason_code || null,
        notes: report.review_notes || null,
      })
    }
    if (Array.isArray(report.data?.audit_trail)) {
      return [...trail, ...report.data.audit_trail]
    }
    return trail
  }

  function computeCounts(rows) {
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    let pending = 0
    let pendingHighDelta = 0
    let incorporatedThisMonth = 0
    let signalOnlyThisMonth = 0
    let rejectedThisMonth = 0

    for (const row of rows) {
      const status = normalizeReportStatus(row.status)
      if (status === 'pending_review') {
        pending += 1
        if (Math.abs(Number(row.benchmark_delta?.delta_pct) || 0) >= HIGH_DELTA_THRESHOLD_PCT) {
          pendingHighDelta += 1
        }
      }
      const decidedAt = row.review?.decided_at || row.incorporated_at || null
      if (decidedAt && decidedAt >= monthStart) {
        if (status === 'incorporated') incorporatedThisMonth += 1
        if (status === 'verified') signalOnlyThisMonth += 1
        if (status === 'rejected') rejectedThisMonth += 1
      }
    }

    return {
      pending,
      pending_high_delta: pendingHighDelta,
      incorporated_this_month: incorporatedThisMonth,
      signal_only_this_month: signalOnlyThisMonth,
      rejected_this_month: rejectedThisMonth,
    }
  }

  return {
    listReports,
    getReport,
    reviewReport,
    bulkReview,
    undoReview,
    exportCsv,
    commitIncorporate,
    enrichReport,
  }
}

function sortReports(rows, sort) {
  const [field, direction] = String(sort).split(':')
  const dir = direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let av
    let bv
    switch (field) {
      case 'submitted_at':
        av = new Date(a.submitted_at || 0).getTime()
        bv = new Date(b.submitted_at || 0).getTime()
        break
      case 'tenure':
        av = Number(a.agent?.tenure_days) || 0
        bv = Number(b.agent?.tenure_days) || 0
        break
      case 'delta_abs':
      default:
        av = Math.abs(Number(a.benchmark_delta?.delta_pct) || 0)
        bv = Math.abs(Number(b.benchmark_delta?.delta_pct) || 0)
        break
    }
    if (av === bv) return 0
    return av > bv ? dir : -dir
  })
}

function withinWindow(iso, within) {
  if (!iso) return false
  const ms = Date.now() - new Date(iso).getTime()
  switch (within) {
    case '24h': return ms <= 24 * 60 * 60 * 1000
    case '7d': return ms <= 7 * 24 * 60 * 60 * 1000
    case '30d': return ms <= 30 * 24 * 60 * 60 * 1000
    default: return true
  }
}

function csv(value) {
  if (value == null) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function coerceUuid(value) {
  if (!value) return null
  const str = String(value)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)) {
    return str
  }
  return null
}
