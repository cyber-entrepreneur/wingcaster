/**
 * Agency application HTTP surface (BE-BLOCKER-06 / AGN-MEM-005).
 *
 * POST /api/agencies/:slug/applications  — public join apply
 *   - Authenticated: create application for session user (guest_signup ignored)
 *   - Anonymous + guest_signup: atomic user create + application (one transaction)
 * POST /api/agencies/apply               — legacy alias → 410 Gone
 * GET  /api/agencies/:id/applications    — owner/admin queue
 * POST /api/agencies/:id/applications/:appId/approve
 * POST /api/agencies/:id/applications/:appId/reject
 *
 * expected_response_by uses +2 calendar days (no business-day helper in-repo).
 */

import { randomUUID } from 'node:crypto'
import { authMiddleware, optionalAuthMiddleware } from '../../auth.js'
import { signToken } from '../../auth.js'
import { findAll, findOne, insert, query, update } from '../../db.js'
import { assertCanJoinAgency } from '../../platformModel.js'
import {
  addAgencyMembership,
  agencyTenantId,
  getAgencyMembership,
} from '../../tenant-authorization.js'
import { updateUser, findUserById, findAgentForUser } from '../../identity.js'
import logger from '../logger.js'
import { agencyApplicationCreateSchema, validate } from '../validation.js'
import { agencyApplicationExpiresAt } from '../../workers/agency-application-expiry.js'
import {
  buildApplicationRow,
  createGuestUserAndApplication,
  guestSignupHttpError,
} from './guest-signup-apply.js'
import { safeEmitAgencyApplicationResolved } from './notify-application-resolved.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])

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

function applicationSuccessPayload(agency, application, session = null) {
  const payload = {
    application: {
      id: application.id,
      agency_id: agency.id,
      agency_name: agency.name,
      status: application.status,
      created_at: application.created_at,
      expected_response_by: application.expected_response_by,
    },
    redirect_to: `/applications/${application.id}`,
  }
  if (session) payload.session = session
  return payload
}

export function registerAgencyApplicationRoutes(app, {
  auth = authMiddleware,
  optionalAuth = optionalAuthMiddleware,
} = {}) {
  app.post('/api/agencies/apply', (_req, res) => {
    res.status(410).json({
      error: 'Gone',
      code: 'ROUTE_MOVED',
      message: 'POST /api/agencies/apply is retired. Use POST /api/agencies/:slug/applications',
    })
  })

  app.post(
    '/api/agencies/:slug/applications',
    optionalAuth,
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
        const guestSignup = req.body?.guest_signup

        // Authenticated path — guest_signup must be null/ignored.
        if (req.user) {
          const agentEmail = String(req.user.email || '').trim().toLowerCase()
          const existing = await findOne(
            'agency_applications',
            pendingMatch({ agencyId: agency.id, userId: req.user.id, email: agentEmail }),
          )
          if (existing) {
            return res.status(409).json({
              error: 'You already have a pending application to this agency',
              code: 'ALREADY_APPLIED',
              existing_application_id: existing.id,
              existing_status: existing.status,
            })
          }

          const now = new Date()
          const application = buildApplicationRow({
            agency,
            user: req.user,
            body,
            now,
          })
          if (!application.id) application.id = randomUUID()
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

          return res.status(201).json(applicationSuccessPayload(agency, application))
        }

        // Anonymous: require guest_signup for atomic signup-on-apply.
        if (guestSignup == null) {
          return res.status(401).json({ error: 'Unauthorized' })
        }

        const emailHint = (() => {
          if (typeof guestSignup !== 'object' || !guestSignup) return ''
          const id = String(guestSignup.identifier || guestSignup.email || '').trim().toLowerCase()
          return id.includes('@') ? id : ''
        })()

        if (emailHint) {
          const existing = await findOne(
            'agency_applications',
            pendingMatch({ agencyId: agency.id, email: emailHint }),
          )
          if (existing) {
            return res.status(409).json({
              error: 'You already have a pending application to this agency',
              code: 'ALREADY_APPLIED',
              existing_application_id: existing.id,
              existing_status: existing.status,
            })
          }
        }

        let result
        try {
          result = await createGuestUserAndApplication({
            agency,
            guestSignup,
            body,
          })
        } catch (err) {
          const handled = guestSignupHttpError(err, res)
          if (handled) return handled
          throw err
        }

        logger.info(
          {
            application_id: result.application.id,
            agency: agency.name,
            agency_id: agency.id,
            applicant_user_id: result.user.id,
            agent_email: result.user.email,
            guest_signup: true,
          },
          'Agency application received (guest signup)',
        )

        return res.status(201).json(
          applicationSuccessPayload(agency, result.application, result.session),
        )
      } catch (err) {
        return next(err)
      }
    },
  )

  app.get('/api/agencies/:id/applications', auth, async (req, res, next) => {
    try {
      const agency = await findAgencyBySlugOrId(req.params.id)
      if (!agency) return res.status(404).json({ error: 'Not found' })
      const member = await getAgencyMembership(agency.id, req.user.id)
      if (!member || !ADMIN_ROLES.has(member.role)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const rows = (await findAll('agency_applications', (a) => a.agency_id === agency.id))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      return res.json(rows)
    } catch (err) {
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
  })
}
