/**
 * Agency application HTTP surface (BE-BLOCKER-06 / AGN-MEM-005).
 *
 * POST /api/agencies/:slug/applications  — public join apply (auth required)
 * POST /api/agencies/apply               — legacy alias → 410 Gone
 * GET  /api/agencies/:id/applications    — owner/admin queue
 * POST /api/agencies/:id/applications/:appId/approve
 * POST /api/agencies/:id/applications/:appId/reject
 *
 * Guest signup-on-apply is intentionally deferred; callers must be signed in.
 * expected_response_by uses +2 calendar days (no business-day helper in-repo).
 */

import { randomUUID } from 'node:crypto'
import { authMiddleware } from '../../auth.js'
import { findAll, findOne, insert, query, update } from '../../db.js'
import { assertCanJoinAgency } from '../../platformModel.js'
import { addAgencyMembership, getAgencyMembership } from '../../tenant-authorization.js'
import logger from '../logger.js'
import { agencyApplicationCreateSchema, validate } from '../validation.js'
import { agencyApplicationExpiresAt } from '../../workers/agency-application-expiry.js'

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
      const updated = await update(
        'agency_applications',
        (a) => a.id === req.params.appId && a.agency_id === agency.id,
        (a) => ({
          ...a,
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: req.user.id,
        }),
      )
      if (!updated) return res.status(404).json({ error: 'Application not found' })
      return res.json({ success: true })
    } catch (err) {
      return next(err)
    }
  })
}
