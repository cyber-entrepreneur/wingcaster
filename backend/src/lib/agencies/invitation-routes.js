/**
 * Agency invitation HTTP surface (BE-BLOCKER-07).
 *
 * GET  /api/invitations/:code              — public resolve
 * POST /api/invitations/:code/accept       — auth OR guest_signup; create application
 * POST /api/agencies/:id/invitations       — owner/admin create (AGN-MEM-003)
 */

import { z } from 'zod'
import { authMiddleware, optionalAuthMiddleware } from '../../auth.js'
import { findOne, transaction } from '../../db.js'
import { getAgencyMembership } from '../../tenant-authorization.js'
import { validate } from '../validation.js'
import logger from '../logger.js'
import {
  createGuestUserAndApplication,
  guestSignupHttpError,
} from './guest-signup-apply.js'
import {
  DEFAULT_INVITE_TTL_DAYS,
  buildResolvePayload,
  createAgencyInvitation,
  createApplicationFromInvitation,
  expiredAcceptError,
  findInvitationByCode,
  invitationStatus,
  isAgencyAcceptingApplications,
  markInvitationUsed,
} from './invitations.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])

export const invitationAcceptSchema = z.object({
  message: z.string().max(2000).optional().default(''),
  current_listings_count: z.coerce.number().int().nonnegative().max(100_000).optional().nullable(),
  portfolio_url: z.string().max(1000).optional().default(''),
  availability: z.string().max(500).optional().default(''),
  referral_source: z.string().max(120).optional(),
  consents: z.record(z.unknown()).optional().nullable(),
  guest_signup: z.unknown().optional().nullable(),
  agent_email: z.string().email().max(255).optional(),
  agent_name: z.string().max(120).optional().default(''),
  agent_phone: z.string().max(40).optional().default(''),
  locale: z.string().max(16).optional(),
}).passthrough()

export const invitationCreateSchema = z.object({
  expires_in_days: z.coerce.number().int().positive().max(365).optional().default(DEFAULT_INVITE_TTL_DAYS),
  expires_at: z.string().datetime({ offset: true }).optional(),
  single_use: z.boolean().optional().default(true),
}).passthrough()

async function requireAgencyOwnerOrAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const agencyId = req.params.id
    const agency = await findOne('agencies', (row) => row.id === agencyId)
    if (!agency) return res.status(404).json({ error: 'Agency not found' })
    const member = await getAgencyMembership(agencyId, req.user.id)
    if (!member || !ADMIN_ROLES.has(member.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    req.agency = agency
    req.membership = member
    next()
  } catch (err) {
    next(err)
  }
}

export function registerAgencyInvitationRoutes(app, {
  auth = authMiddleware,
  optionalAuth = optionalAuthMiddleware,
} = {}) {
  app.get('/api/invitations/:code', async (req, res) => {
    try {
      const invite = await findInvitationByCode(req.params.code)
      if (!invite) return res.status(404).json({ error: 'Invitation not found' })
      const agency = await findOne('agencies', (row) => row.id === invite.agency_id)
      if (!agency) return res.status(404).json({ error: 'Invitation not found' })
      return res.json(buildResolvePayload(invite, agency))
    } catch (err) {
      logger.error({ err: err.message, code: req.params.code }, 'resolve agency invitation failed')
      return res.status(500).json({ error: 'Failed to resolve invitation' })
    }
  })

  app.post(
    '/api/invitations/:code/accept',
    optionalAuth,
    validate(invitationAcceptSchema),
    async (req, res) => {
      try {
        const guestSignup = req.body?.guest_signup
        // No session and no guest_signup → 401 before invitation lookup so
        // unknown codes do not leak as 404 to anonymous callers.
        if (!req.user && guestSignup == null) {
          return res.status(401).json({ error: 'Unauthorized' })
        }

        const invite = await findInvitationByCode(req.params.code)
        if (!invite) return res.status(404).json({ error: 'Invitation not found' })

        const agency = await findOne('agencies', (row) => row.id === invite.agency_id)
        if (!agency) return res.status(404).json({ error: 'Agency not found' })

        const status = invitationStatus(invite)
        if (status === 'revoked') {
          return res.status(410).json({
            error: 'INVITATION_REVOKED',
            message: 'This invitation has been revoked.',
          })
        }
        if (status === 'expired') {
          return res.status(410).json(expiredAcceptError(invite, agency))
        }
        if (status === 'used') {
          return res.status(409).json({
            error: 'INVITATION_USED',
            message: 'This invitation has already been used.',
          })
        }

        if (!isAgencyAcceptingApplications(agency)) {
          return res.status(409).json({
            error: 'AGENCY_NOT_ACCEPTING',
            message: 'This agency is not currently accepting applications.',
          })
        }

        // Authenticated: guest_signup ignored.
        if (req.user) {
          // Claim single-use codes before inserting the application to avoid
          // orphaned applications when a concurrent accept wins the race.
          if (invite.single_use) {
            const claimed = await markInvitationUsed(invite.id)
            if (!claimed) {
              return res.status(409).json({
                error: 'INVITATION_USED',
                message: 'This invitation has already been used.',
              })
            }
          }

          const application = await createApplicationFromInvitation({
            invite,
            agency,
            user: req.user,
            body: req.validated,
          })

          logger.info(
            {
              application_id: application.id,
              agency_id: agency.id,
              invitation_code: invite.code,
              user_id: req.user.id,
            },
            'Agency invitation accepted',
          )

          return res.status(201).json({
            success: true,
            application: {
              ...application,
              agency_name: agency.name,
            },
            redirect_to: `/applications/${application.id}`,
            message: `Application sent to ${agency.name}. They will review and approve your request.`,
          })
        }

        let result
        try {
          // Claim + user + application in one transaction so a failed guest
          // signup does not burn a single-use invitation or leave an orphan user.
          result = await transaction(async () => {
            if (invite.single_use) {
              const claimed = await markInvitationUsed(invite.id)
              if (!claimed) {
                const usedErr = new Error('INVITATION_USED')
                usedErr.code = 'INVITATION_USED'
                usedErr.status = 409
                throw usedErr
              }
            }
            return createGuestUserAndApplication({
              agency,
              guestSignup,
              body: {
                ...req.validated,
                message: String(req.validated.message || '').trim() || 'Invitation accept',
              },
              invitationCode: invite.code,
              referralSource: 'direct_invitation',
            })
          })
        } catch (err) {
          if (err?.code === 'INVITATION_USED') {
            return res.status(409).json({
              error: 'INVITATION_USED',
              message: 'This invitation has already been used.',
            })
          }
          const handled = guestSignupHttpError(err, res)
          if (handled) return handled
          throw err
        }

        logger.info(
          {
            application_id: result.application.id,
            agency_id: agency.id,
            invitation_code: invite.code,
            user_id: result.user.id,
            guest_signup: true,
          },
          'Agency invitation accepted (guest signup)',
        )

        return res.status(201).json({
          success: true,
          application: {
            ...result.application,
            agency_name: agency.name,
          },
          session: result.session,
          redirect_to: `/applications/${result.application.id}`,
          message: `Application sent to ${agency.name}. They will review and approve your request.`,
        })
      } catch (err) {
        logger.error(
          { err: err.message, code: req.params.code, user_id: req.user?.id },
          'accept agency invitation failed',
        )
        return res.status(500).json({ error: 'Failed to accept invitation' })
      }
    },
  )

  app.post(
    '/api/agencies/:id/invitations',
    auth,
    requireAgencyOwnerOrAdmin,
    validate(invitationCreateSchema),
    async (req, res) => {
      try {
        const body = req.validated
        const invite = await createAgencyInvitation({
          agencyId: req.agency.id,
          createdBy: req.user.id,
          expiresAt: body.expires_at,
          expiresInDays: body.expires_in_days,
          singleUse: body.single_use,
        })
        return res.status(201).json({
          id: invite.id,
          code: invite.code,
          agency_id: invite.agency_id,
          expires_at: invite.expires_at,
          single_use: invite.single_use,
          created_by: invite.created_by,
          created_at: invite.created_at,
        })
      } catch (err) {
        logger.error(
          { err: err.message, agency_id: req.agency?.id, user_id: req.user?.id },
          'create agency invitation failed',
        )
        return res.status(500).json({ error: 'Failed to create invitation' })
      }
    },
  )
}

export { registerAgencyInvitationRoutes as registerRoutes }
