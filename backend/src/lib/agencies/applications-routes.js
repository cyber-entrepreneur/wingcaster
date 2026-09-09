/**
 * Agency application HTTP surface (BE-BLOCKER-06 / AGN-MEM-005 / AGN-MEM-002).
 *
 * POST /api/agencies/:slug/applications  — public join apply (auth required)
 * POST /api/agencies/apply               — legacy alias → 410 Gone
 * GET  /api/agencies/:id/applications    — owner/admin queue
 * GET  /api/agencies/:id/applications.csv — owner/admin CSV export (status/within/q)
 * POST /api/agencies/:id/applications/:appId/approve
 * POST /api/agencies/:id/applications/:appId/reject
 * POST /api/agencies/:id/applications/:appId/reveal-contact — audited PII reveal
 *
 * Guest signup-on-apply is intentionally deferred; callers must be signed in.
 * expected_response_by uses +2 calendar days (no business-day helper in-repo).
 */

import { randomUUID } from 'node:crypto'
import { authMiddleware } from '../../auth.js'
import { signToken } from '../../auth.js'
import { findAll, findOne, insert, query, update } from '../../db.js'
import { assertCanJoinAgency } from '../../platformModel.js'
import { addAgencyMembership, agencyTenantId, getAgencyMembership } from '../../tenant-authorization.js'
import { updateUser, findUserById, findAgentForUser } from '../../identity.js'
import logger from '../logger.js'
import { agencyApplicationCreateSchema, validate } from '../validation.js'
import { agencyApplicationExpiresAt } from '../../workers/agency-application-expiry.js'
import { safeEmitAgencyApplicationResolved } from './notify-application-resolved.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])

/** Mirrors account-recovery reveal-audit rate limit (optional soft cap). */
export const APPLICATION_REVEAL_RATE_LIMIT_PER_HOUR = 20

export const APPLICATION_REVEAL_FIELDS = Object.freeze(['contact', 'email', 'phone'])

/** Stable CSV columns matching the prior client-side queue export. */
export const APPLICATION_CSV_COLUMNS = Object.freeze([
  'id',
  'applicant_name',
  'applicant_city',
  'applied_at',
  'listings_count',
  'status',
  'message',
  'decided_at',
  'decided_by',
  'reason',
])

export class ApplicationRevealError extends Error {
  constructor(code, message, { httpStatus = 400, extra = {} } = {}) {
    super(message)
    this.name = 'ApplicationRevealError'
    this.code = code
    this.httpStatus = httpStatus
    this.extra = extra
  }

  toJSON() {
    return { error: this.message, code: this.code, ...this.extra }
  }
}

/** Calendar-day SLA until a business-day helper lands. */
export function expectedResponseBy(from = new Date(), calendarDays = 2) {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + calendarDays)
  return d.toISOString()
}

export async function findAgencyBySlugOrId(slugOrId) {
  const key = String(slugOrId || '')
  if (!key) return null
  return (
    (await findOne('agencies', (a) => a.slug === key))
    || (await findOne('agencies', (a) => a.id === key))
    || null
  )
}

/**
 * Gate on agencies.accepting_applications when the column exists (BE-08 / 326).
 * Missing column or NULL → treat as accepting (true).
 */
export async function isAgencyAcceptingApplications(agencyId) {
  try {
    const rows = await query(
      `SELECT accepting_applications FROM public.agencies WHERE id = $1`,
      [agencyId],
    )
    if (!rows.length) return true
    const value = rows[0].accepting_applications
    if (value === null || value === undefined) return true
    return Boolean(value)
  } catch (err) {
    // undefined_column — parallel migration 326 not applied yet
    if (err?.code === '42703') return true
    throw err
  }
}

function pendingMatch({ agencyId, userId, email }) {
  return (row) => {
    if (row.agency_id !== agencyId || row.status !== 'pending') return false
    if (userId && row.applicant_user_id && row.applicant_user_id === userId) return true
    if (email && row.agent_email && String(row.agent_email).toLowerCase() === email) return true
    return false
  }
}

function applicationBelongsToCaller(row, user) {
  if (!row || !user) return false
  if (row.applicant_user_id && row.applicant_user_id === user.id) return true
  const email = String(user.email || '').trim().toLowerCase()
  if (email && row.agent_email && String(row.agent_email).toLowerCase() === email) return true
  return false
}

function normalizeRejectedBy(row) {
  if (row.status !== 'rejected') return null
  if (row.rejected_by === 'applicant' || row.rejected_by_role === 'applicant') return 'applicant'
  if (row.rejected_by === 'agency') return 'agency'
  // Legacy: rejected_by stored the agency admin user id
  if (row.rejected_by && row.rejected_by === row.applicant_user_id) return 'applicant'
  if (row.rejected_by) return 'agency'
  return 'agency'
}

function slaDaysFromRow(row) {
  const raw = row.sla_days ?? row.data?.sla_days ?? row.data?.review_sla_days
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 3
}

async function buildApplicantOutcomePayload(appRecord) {
  const agency = await findOne('agencies', (a) => a.id === appRecord.agency_id)
  if (!agency) return null

  const data = appRecord.data && typeof appRecord.data === 'object' ? appRecord.data : {}
  const agencyData = agency.data && typeof agency.data === 'object' ? agency.data : {}
  const submittedAt = appRecord.created_at || appRecord.submitted_at
  const decidedAt =
    appRecord.decided_at
    || appRecord.approved_at
    || appRecord.rejected_at
    || data.decided_at
    || null
  const resolvedAt =
    appRecord.resolved_at
    || (appRecord.status !== 'pending' ? decidedAt : null)
    || null
  const viewedAt = appRecord.viewed_at || data.viewed_at || null
  const expiresAt =
    appRecord.expires_at
    || agencyApplicationExpiresAt(new Date(submittedAt || Date.now()))

  let resolver = null
  const resolverId = appRecord.approved_by || (normalizeRejectedBy(appRecord) === 'agency' ? appRecord.rejected_by : null)
  if (resolverId && resolverId !== 'agency' && resolverId !== 'applicant') {
    const resolverUser = await findUserById(resolverId)
    if (resolverUser) {
      const member = await getAgencyMembership(agency.id, resolverId)
      resolver = {
        user_id: resolverUser.id,
        display_name: resolverUser.name || resolverUser.email || 'Agency reviewer',
        role_label: member?.role === 'admin' ? 'Admin' : 'Owner',
        avatar_url: resolverUser.avatar_url || resolverUser.photo_url || null,
      }
    }
  }
  if (!resolver && data.decision_resolver) {
    resolver = data.decision_resolver
  }

  const slug = agency.slug || agency.id
  return {
    application: {
      id: appRecord.id,
      status: appRecord.status,
      rejected_by: normalizeRejectedBy(appRecord),
      submitted_at: submittedAt,
      viewed_at: viewedAt,
      decided_at: decidedAt,
      resolved_at: resolvedAt,
      expires_at: expiresAt,
      sla_days: slaDaysFromRow(appRecord),
    },
    agency: {
      tenant_id: agencyTenantId(agency.id),
      slug,
      display_name: agency.name,
      logo_url: agency.logo_url || agencyData.logo_url || null,
      primary_market_label:
        agency.primary_market_label
        || agencyData.primary_market_label
        || agencyData.market_label
        || null,
      suspended_at: agency.suspended_at || agencyData.suspended_at || null,
      deleted_at: agency.deleted_at || agencyData.deleted_at || null,
      public_profile_url: `/agencies/${slug}`,
    },
    decision: {
      resolver,
      message: data.decision_message ?? data.resolver_message ?? appRecord.decision_message ?? null,
      role_offered: appRecord.approved_role || data.role_offered || null,
      capability_pack: data.capability_pack || (appRecord.status === 'approved' ? 'standard' : null),
      affiliation_mode: appRecord.affiliation_mode || data.affiliation_mode || null,
    },
  }
}

async function requireAgencyAdmin(agencyIdOrSlug, userId) {
  const agency = await findAgencyBySlugOrId(agencyIdOrSlug)
  if (!agency) return { agency: null, member: null, status: 404, error: 'Not found' }
  const member = await getAgencyMembership(agency.id, userId)
  if (!member || !ADMIN_ROLES.has(member.role)) {
    return { agency, member: null, status: 403, error: 'Forbidden' }
  }
  return { agency, member, status: 200 }
}

function withinCutoffMs(within, now = Date.now()) {
  switch (String(within || '')) {
    case '7d':
      return now - 7 * 86400000
    case '30d':
      return now - 30 * 86400000
    case '90d':
      return now - 90 * 86400000
    case 'all':
      return null
    default:
      return now - 30 * 86400000
  }
}

function normalizeApplicationStatus(raw) {
  const s = String(raw || '').toLowerCase()
  if (s === 'approved' || s === 'rejected' || s === 'expired' || s === 'pending') return s
  return 'pending'
}

/**
 * Filter agency_applications rows the same way the queue UI does (status/within/q).
 */
export function filterAgencyApplicationRows(rows, { status = 'pending', within = '30d', q = '' } = {}) {
  const wantedStatus = normalizeApplicationStatus(status)
  const cutoff = withinCutoffMs(within)
  const needle = String(q || '').trim().toLowerCase()
  return (rows || []).filter((row) => {
    if (normalizeApplicationStatus(row.status) !== wantedStatus) return false
    const appliedAt = row.created_at || row.updated_at
    if (cutoff != null && appliedAt && new Date(appliedAt).getTime() < cutoff) return false
    if (needle.length >= 1) {
      const hay = `${row.agent_name || ''} ${row.city || ''} ${row.agent_email || ''}`.toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
}

function csvEscape(value) {
  if (value == null) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function rowsToApplicationCsv(columns, rows) {
  const header = columns.join(',')
  const lines = rows.map((row) => columns.map((col) => csvEscape(row[col])).join(','))
  return `${[header, ...lines].join('\n')}\n`
}

export function applicationToCsvRow(row) {
  const decidedAt = row.approved_at || row.rejected_at || ''
  const decidedBy = row.approved_by || row.rejected_by || ''
  return {
    id: row.id,
    applicant_name: row.agent_name || row.agent_email || '',
    applicant_city: row.city || '',
    applied_at: row.created_at || row.updated_at || '',
    listings_count: row.current_listings_count ?? '',
    status: row.status || '',
    message: row.message || '',
    decided_at: decidedAt,
    decided_by: decidedBy,
    reason: row.rejection_reason || '',
  }
}

export async function buildAgencyApplicationsCsv({
  agencyId,
  query: filters = {},
  findAllFn = findAll,
} = {}) {
  const status = normalizeApplicationStatus(filters.status || 'pending')
  const within = ['7d', '30d', '90d', 'all'].includes(String(filters.within || ''))
    ? String(filters.within)
    : '30d'
  const q = String(filters.q || '')
  const rows = (await findAllFn('agency_applications', (a) => a.agency_id === agencyId))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const filtered = filterAgencyApplicationRows(rows, { status, within, q })
  const csvRows = filtered.map(applicationToCsvRow)
  const filename = `agency-applications-${status}-${within}.csv`
  return {
    csv: rowsToApplicationCsv(APPLICATION_CSV_COLUMNS, csvRows),
    filename,
    rowCount: csvRows.length,
    filters: { status, within, q },
  }
}

async function countApplicationRevealsInLastHour(reviewerId, now = new Date()) {
  const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  try {
    const rowsRaw = await query(
      `SELECT COUNT(*)::int AS n
         FROM public.audit_log
        WHERE agent_id = $1
          AND action = 'reveal'
          AND entity_type = 'agency_application'
          AND created_at >= $2::timestamptz`,
      [String(reviewerId), since],
    )
    const rows = Array.isArray(rowsRaw) ? rowsRaw : (rowsRaw?.rows || [])
    return Number(rows[0]?.n || 0)
  } catch {
    return 0
  }
}

/**
 * Write audited contact reveal for an agency application (AGN-MEM-002b).
 * Mirrors account-recovery/reveal-audit.js patterns: reviewer, field, ip, ua, rate limit.
 */
export async function recordApplicationContactReveal({
  applicationId,
  agencyId,
  reviewerId,
  field = 'contact',
  ip = null,
  userAgent = null,
}) {
  const normalizedField = String(field || 'contact').trim().toLowerCase()
  if (!APPLICATION_REVEAL_FIELDS.includes(normalizedField)) {
    throw new ApplicationRevealError(
      'INVALID_FIELD',
      `field must be one of: ${APPLICATION_REVEAL_FIELDS.join(', ')}`,
      { httpStatus: 400 },
    )
  }

  const appRecord = await findOne(
    'agency_applications',
    (a) => a.id === applicationId && a.agency_id === agencyId,
  )
  if (!appRecord) {
    throw new ApplicationRevealError('NOT_FOUND', 'Application not found', { httpStatus: 404 })
  }

  const used = await countApplicationRevealsInLastHour(reviewerId)
  if (used >= APPLICATION_REVEAL_RATE_LIMIT_PER_HOUR) {
    throw new ApplicationRevealError(
      'RATE_LIMITED',
      'Reveal rate limit reached — try again in an hour.',
      {
        httpStatus: 429,
        extra: {
          limit: APPLICATION_REVEAL_RATE_LIMIT_PER_HOUR,
          used,
          retry_after_seconds: 3600,
        },
      },
    )
  }

  const nowIso = new Date().toISOString()
  const id = randomUUID()
  await insert('audit_log', {
    id,
    agent_id: reviewerId,
    agency_id: agencyId,
    type: 'agency_application_pii_viewed',
    action: 'reveal',
    entity_type: 'agency_application',
    entity_id: applicationId,
    ip: ip || null,
    user_agent: userAgent || null,
    metadata: {
      field: normalizedField,
      application_id: applicationId,
      agency_id: agencyId,
      reviewer_id: reviewerId,
      source: 'agency_application_reveal_contact',
    },
    created_at: nowIso,
  })

  return {
    success: true,
    field: normalizedField,
    application_id: applicationId,
    remaining: Math.max(0, APPLICATION_REVEAL_RATE_LIMIT_PER_HOUR - used - 1),
    limit: APPLICATION_REVEAL_RATE_LIMIT_PER_HOUR,
  }
}

export function registerAgencyApplicationRoutes(app, { auth = authMiddleware } = {}) {
  app.post('/api/agencies/apply', (_req, res) => {
    res.status(410).json({
      error: 'Gone',
      code: 'ROUTE_MOVED',
      message: 'POST /api/agencies/apply is retired. Use POST /api/agencies/:slug/applications',
    })
  })

  app.post(
    '/api/agencies/:slug/applications',
    auth,
    validate(agencyApplicationCreateSchema),
    async (req, res, next) => {
      try {
        const agency = await findAgencyBySlugOrId(req.params.slug)
        if (!agency) return res.status(404).json({ error: 'Agency not found' })

        const accepting = await isAgencyAcceptingApplications(agency.id)
        if (!accepting) {
          return res.status(409).json({
            error: 'This agency is not accepting applications',
            code: 'AGENCY_NOT_ACCEPTING',
          })
        }

        const body = req.validated
        const agentEmail = String(req.user.email || '').trim().toLowerCase()
        const existing = await findOne(
          'agency_applications',
          pendingMatch({ agencyId: agency.id, userId: req.user.id, email: agentEmail }),
        )
        if (existing) {
          return res.status(409).json({
            error: 'You already have a pending application to this agency',
            code: 'ALREADY_APPLIED',
          })
        }

        const now = new Date()
        const createdAt = now.toISOString()
        const application = {
          id: randomUUID(),
          agency_id: agency.id,
          applicant_user_id: req.user.id,
          agent_email: agentEmail,
          agent_name: req.user.name || '',
          agent_phone: '',
          message: body.message,
          current_listings_count: body.current_listings_count ?? null,
          portfolio_url: body.portfolio_url ?? null,
          availability: body.availability ?? null,
          referral_source: body.referral_source ?? null,
          profile_share_consent: true,
          invitation_code: body.invitation_code ?? null,
          expected_response_by: expectedResponseBy(now),
          expires_at: agencyApplicationExpiresAt(now),
          status: 'pending',
          created_at: createdAt,
          updated_at: createdAt,
        }
        await insert('agency_applications', application)

        logger.info(
          {
            application_id: application.id,
            agency: agency.name,
            agency_id: agency.id,
            applicant_user_id: req.user.id,
            agent_email: agentEmail,
          },
          'Agency application received',
        )

        return res.status(201).json({
          application: {
            id: application.id,
            agency_id: agency.id,
            agency_name: agency.name,
            status: application.status,
            created_at: application.created_at,
            expected_response_by: application.expected_response_by,
          },
          redirect_to: `/applications/${application.id}`,
        })
      } catch (err) {
        return next(err)
      }
    },
  )

  app.get('/api/agencies/:id/applications', auth, async (req, res, next) => {
    try {
      const gate = await requireAgencyAdmin(req.params.id, req.user.id)
      if (gate.status !== 200) return res.status(gate.status).json({ error: gate.error })
      const rows = (await findAll('agency_applications', (a) => a.agency_id === gate.agency.id))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      return res.json(rows)
    } catch (err) {
      return next(err)
    }
  })

  /**
   * AGN-MEM-002 — CSV export with the same query filters as the queue UI.
   * AuthZ mirrors GET /applications (agency owner/admin only).
   */
  app.get('/api/agencies/:id/applications.csv', auth, async (req, res, next) => {
    try {
      const gate = await requireAgencyAdmin(req.params.id, req.user.id)
      if (gate.status !== 200) return res.status(gate.status).json({ error: gate.error })

      const built = await buildAgencyApplicationsCsv({
        agencyId: gate.agency.id,
        query: req.query,
      })

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${built.filename}"`)
      res.setHeader('X-Agency-Applications-Export-Rows', String(built.rowCount))
      return res.status(200).send(built.csv)
    } catch (err) {
      return next(err)
    }
  })

  /**
   * AGN-MEM-002b — audited contact reveal before UI unmasks applicant PII.
   * Writes public.audit_log (reviewer, field, ip, user_agent).
   */
  app.post('/api/agencies/:id/applications/:appId/reveal-contact', auth, async (req, res, next) => {
    try {
      const gate = await requireAgencyAdmin(req.params.id, req.user.id)
      if (gate.status !== 200) return res.status(gate.status).json({ error: gate.error })

      const payload = await recordApplicationContactReveal({
        applicationId: req.params.appId,
        agencyId: gate.agency.id,
        reviewerId: req.user.id,
        field: req.body?.field || 'contact',
        ip: req.ip,
        userAgent: req.get('user-agent') || null,
      })
      return res.json(payload)
    } catch (err) {
      if (err instanceof ApplicationRevealError) {
        return res.status(err.httpStatus).json(err.toJSON())
      }
      return next(err)
    }
  })

  app.post('/api/agencies/:id/applications/:appId/approve', auth, async (req, res, next) => {
    try {
      const agency = await findAgencyBySlugOrId(req.params.id)
      if (!agency) return res.status(404).json({ error: 'Not found' })
      const member = await getAgencyMembership(agency.id, req.user.id)
      if (!member || !ADMIN_ROLES.has(member.role)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const appRecord = await findOne(
        'agency_applications',
        (a) => a.id === req.params.appId && a.agency_id === agency.id,
      )
      if (!appRecord) return res.status(404).json({ error: 'Application not found' })

      const role = req.body?.role
      const affiliationMode = req.body?.affiliation_mode
      if (!role || !affiliationMode) {
        return res.status(400).json({
          error: 'role and affiliation_mode are required; Tenant Admin must explicitly classify the relationship',
        })
      }
      if (role === 'owner') {
        return res.status(400).json({ error: 'Ownership requires the ownership transfer workflow' })
      }
      if (role === 'admin' && member.role !== 'owner') {
        return res.status(403).json({ error: 'Only a tenant owner can grant the admin role' })
      }

      const agent = await findOne('agents', (a) => a.email === appRecord.agent_email)
        || (appRecord.applicant_user_id
          ? await findOne('agents', (a) => a.id === appRecord.applicant_user_id || a.user_id === appRecord.applicant_user_id)
          : null)
      if (!agent) return res.status(409).json({ error: 'Applicant must create an account before approval' })
      const check = await assertCanJoinAgency(agent.id, agency.id, { role, affiliationMode })
      if (!check.ok) return res.status(409).json({ error: check.error })

      await addAgencyMembership({
        agencyId: agency.id,
        userId: agent.id,
        role,
        affiliationMode,
        invitedBy: req.user.id,
      })
      await update('agency_applications', (a) => a.id === appRecord.id, (a) => ({
        ...a,
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: req.user.id,
        approved_role: role,
        affiliation_mode: affiliationMode,
      }))
      if (affiliationMode === 'exclusive') {
        await update('agents', (a) => a.id === agent.id, (a) => ({ ...a, agency_name: agency.name }))
      }

      // Non-blocking: AGT-REC-004 / Wave 1 Agent 5 notification hook.
      const recipientId = appRecord.applicant_user_id || agent.id
      await safeEmitAgencyApplicationResolved({
        userId: recipientId,
        agencyName: agency.name,
        applicationId: appRecord.id,
        newStatus: 'approved',
      })

      return res.json({ success: true })
    } catch (err) {
      return next(err)
    }
  })

  app.post('/api/agencies/:id/applications/:appId/reject', auth, async (req, res, next) => {
    try {
      const agency = await findAgencyBySlugOrId(req.params.id)
      if (!agency) return res.status(404).json({ error: 'Not found' })
      const member = await getAgencyMembership(agency.id, req.user.id)
      if (!member || !ADMIN_ROLES.has(member.role)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const appRecord = await findOne(
        'agency_applications',
        (a) => a.id === req.params.appId && a.agency_id === agency.id,
      )
      if (!appRecord) return res.status(404).json({ error: 'Application not found' })

      const updated = await update(
        'agency_applications',
        (a) => a.id === appRecord.id,
        (a) => ({
          ...a,
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: req.user.id,
        }),
      )
      if (!updated) return res.status(404).json({ error: 'Application not found' })

      // Non-blocking: AGT-REC-004 / Wave 1 Agent 5 notification hook.
      if (appRecord.applicant_user_id) {
        await safeEmitAgencyApplicationResolved({
          userId: appRecord.applicant_user_id,
          agencyName: agency.name,
          applicationId: appRecord.id,
          newStatus: 'rejected',
        })
      } else {
        logger.warn(
          { applicationId: appRecord.id },
          'agency_application.resolved reject skipped: missing applicant_user_id',
        )
      }

      return res.json({ success: true })
    } catch (err) {
      return next(err)
    }
  })

  // ── Applicant-facing outcome surface (AGT-REC-004) ─────────────────────────
  // Scoped to caller's user_id — other users' applications return 404 (not 403).

  app.get('/api/users/me/agency-applications/:id', auth, async (req, res, next) => {
    try {
      const appRecord = await findOne('agency_applications', (a) => a.id === req.params.id)
      if (!appRecord || !applicationBelongsToCaller(appRecord, req.user)) {
        return res.status(404).json({ error: 'Not found' })
      }
      const payload = await buildApplicantOutcomePayload(appRecord)
      if (!payload) return res.status(404).json({ error: 'Not found' })
      return res.json(payload)
    } catch (err) {
      return next(err)
    }
  })

  app.post('/api/users/me/agency-applications/:id/accept', auth, async (req, res, next) => {
    try {
      const appRecord = await findOne('agency_applications', (a) => a.id === req.params.id)
      if (!appRecord || !applicationBelongsToCaller(appRecord, req.user)) {
        return res.status(404).json({ error: 'Not found' })
      }
      if (appRecord.status !== 'approved') {
        return res.status(409).json({ error: 'Application is not awaiting acceptance' })
      }

      const tenantId = agencyTenantId(appRecord.agency_id)
      await updateUser(req.user.id, { active_tenant_id: tenantId })
      const user = await findUserById(req.user.id)
      const agent = await findAgentForUser(req.user.id)
      const token = signToken({
        id: user.id,
        email: user.email,
        name: user.name,
        token_version: user.token_version || 0,
        verified_at: user.verified_at || null,
        active_tenant_id: tenantId,
      })

      const payload = await buildApplicantOutcomePayload(appRecord)
      return res.json({
        success: true,
        application: payload?.application,
        token,
        active_tenant_id: tenantId,
        activeTenantId: tenantId,
        agent: agent || undefined,
      })
    } catch (err) {
      return next(err)
    }
  })

  app.post('/api/users/me/agency-applications/:id/decline', auth, async (req, res, next) => {
    try {
      const appRecord = await findOne('agency_applications', (a) => a.id === req.params.id)
      if (!appRecord || !applicationBelongsToCaller(appRecord, req.user)) {
        return res.status(404).json({ error: 'Not found' })
      }
      if (appRecord.status !== 'approved') {
        return res.status(409).json({ error: 'Only an approved offer can be declined' })
      }
      const now = new Date().toISOString()
      const updated = await update(
        'agency_applications',
        (a) => a.id === appRecord.id,
        (a) => ({
          ...a,
          status: 'rejected',
          rejected_at: now,
          rejected_by: 'applicant',
          decided_at: now,
          resolved_at: now,
          data: {
            ...(a.data && typeof a.data === 'object' ? a.data : {}),
            rejected_by_role: 'applicant',
          },
        }),
      )
      const payload = updated ? await buildApplicantOutcomePayload(updated) : null
      return res.json({ success: true, application: payload?.application })
    } catch (err) {
      return next(err)
    }
  })

  app.post('/api/users/me/agency-applications/:id/withdraw', auth, async (req, res, next) => {
    try {
      const appRecord = await findOne('agency_applications', (a) => a.id === req.params.id)
      if (!appRecord || !applicationBelongsToCaller(appRecord, req.user)) {
        return res.status(404).json({ error: 'Not found' })
      }
      if (appRecord.status !== 'pending') {
        return res.status(409).json({ error: 'Only a pending application can be withdrawn' })
      }
      const now = new Date().toISOString()
      const updated = await update(
        'agency_applications',
        (a) => a.id === appRecord.id,
        (a) => ({
          ...a,
          status: 'withdrawn',
          decided_at: now,
          resolved_at: now,
        }),
      )
      const payload = updated ? await buildApplicantOutcomePayload(updated) : null
      return res.json({ success: true, application: payload?.application })
    } catch (err) {
      return next(err)
    }
  })}
