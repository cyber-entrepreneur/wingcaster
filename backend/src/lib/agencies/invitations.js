/**
 * Agency invitation codes (BE-BLOCKER-07 / AGN-MEM-003 + AGN-MEM-005).
 *
 * Codes are opaque URL-safe tokens. Accept creates an agency_applications row
 * via the DAL (real table when BE-06 lands, legacy_collections otherwise) and
 * stamps used_at for single-use invites.
 */

import { randomBytes, randomUUID } from 'node:crypto'
import { findOne, insert, query } from '../../db.js'

export const DEFAULT_INVITE_TTL_DAYS = 14

export function generateInvitationCode() {
  return randomBytes(18).toString('base64url')
}

export function invitationStatus(invite, { now = new Date() } = {}) {
  if (!invite) return null
  if (invite.revoked_at) return 'revoked'
  if (invite.single_use && invite.used_at) return 'used'
  if (new Date(invite.expires_at).getTime() < now.getTime()) return 'expired'
  return 'valid'
}

export function publicAgencyPayload(agency) {
  if (!agency) return null
  return {
    id: agency.id,
    name: agency.name,
    slug: agency.slug || null,
    logo: agency.logo || null,
    description: agency.description || null,
  }
}

export async function findInvitationByCode(code) {
  const normalized = String(code || '').trim()
  if (!normalized) return null
  return (await findOne('agency_invitations', (row) => row.code === normalized)) || null
}

/**
 * Defensive read of accepting_applications (owned by BE-08).
 * Missing column / undefined value → treat as accepting.
 */
export function isAgencyAcceptingApplications(agency) {
  if (!agency || typeof agency !== 'object') return true
  if (!Object.prototype.hasOwnProperty.call(agency, 'accepting_applications')) return true
  if (agency.accepting_applications === null || agency.accepting_applications === undefined) return true
  return agency.accepting_applications !== false
}

export async function createAgencyInvitation({
  agencyId,
  createdBy,
  expiresAt,
  expiresInDays = DEFAULT_INVITE_TTL_DAYS,
  singleUse = true,
}) {
  if (!agencyId) throw new Error('agencyId is required')
  const now = new Date()
  let expires = expiresAt ? new Date(expiresAt) : null
  if (!expires || Number.isNaN(expires.getTime())) {
    expires = new Date(now.getTime() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
  }
  const invite = {
    id: randomUUID(),
    agency_id: agencyId,
    code: generateInvitationCode(),
    created_by: createdBy || null,
    expires_at: expires.toISOString(),
    single_use: singleUse !== false,
    used_at: null,
    revoked_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }
  return insert('agency_invitations', invite)
}

export async function markInvitationUsed(inviteId, { usedAt = new Date().toISOString() } = {}) {
  // Atomic single-use claim: only stamp used_at when still unused.
  const rows = await query(
    `UPDATE public.agency_invitations
        SET used_at = $2::timestamptz,
            updated_at = $2::timestamptz,
            data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('used_at', $2::text)
      WHERE id = $1
        AND revoked_at IS NULL
        AND (single_use = false OR used_at IS NULL)
      RETURNING id, used_at`,
    [inviteId, usedAt],
  )
  return rows[0] || null
}

export async function createApplicationFromInvitation({
  invite,
  agency,
  user,
  body = {},
}) {
  const now = new Date().toISOString()
  const application = {
    id: randomUUID(),
    agency_id: agency.id,
    applicant_user_id: user?.id || null,
    agent_email: body.agent_email || user?.email || '',
    agent_name: body.agent_name || user?.name || '',
    agent_phone: body.agent_phone || user?.phone || '',
    message: body.message || '',
    current_listings_count: body.current_listings_count ?? null,
    portfolio_url: body.portfolio_url || '',
    availability: body.availability || '',
    referral_source: body.referral_source || 'direct_invitation',
    invitation_code: invite.code,
    consents: body.consents ?? null,
    guest_signup: body.guest_signup ?? null,
    expires_at: agencyApplicationExpiresAt(now),
    status: 'pending',
    created_at: now,
    updated_at: now,
  }
  return insert('agency_applications', application)
}

export function buildResolvePayload(invite, agency, { now = new Date() } = {}) {
  const status = invitationStatus(invite, { now })
  return {
    code: invite.code,
    agency: publicAgencyPayload(agency),
    expires_at: invite.expires_at,
    single_use: Boolean(invite.single_use),
    status,
  }
}

export function expiredAcceptError(invite, agency) {
  return {
    error: 'INVITATION_EXPIRED',
    expired_at: invite.expires_at,
    fallback_slug: agency?.slug || null,
    message: 'This invitation has expired. You can still apply from the agency profile if applications are open.',
  }
}
