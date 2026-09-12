/**
 * AGN-MEM-005 guest signup-on-apply — atomic user + agency_applications.
 *
 * Reuses createAgentAccount (same solo / agency_mode=none provisioning as
 * POST /api/auth/register). Runs inside one DAL transaction so a failed
 * application insert rolls back the user (no orphan accounts).
 *
 * guest_signup carries the SHR-AUT-006 identity sub-object:
 *   { type, identifier, credentials, recovery?, name? / display_name? }
 */

import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { signToken } from '../../auth.js'
import { findOne, insert, transaction } from '../../db.js'
import { createAgentAccount, findUserByEmail } from '../../identity.js'
import {
  FreeTrialAlreadyClaimedError,
  freeTrialClaimedHttpBody,
} from '../auth/free-trial-claims.js'
import { ensureUniqueAgentSlug } from '../../platformModel.js'
import { agencyApplicationExpiresAt } from '../../workers/agency-application-expiry.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function expectedResponseByLocal(from = new Date(), calendarDays = 2) {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + calendarDays)
  return d.toISOString()
}

/**
 * Validate guest_signup identity. Returns either `{ ok, value }` or
 * `{ ok: false, field_errors }` with brief-style keys.
 */
export function parseGuestSignup(raw) {
  const field_errors = {}
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      field_errors: { guest_signup: 'required' },
    }
  }

  const type = String(raw.type || 'email').toLowerCase()
  if (!['email', 'username', 'phone'].includes(type)) {
    // OAuth types are not supported on the compact guest path yet.
    field_errors['guest_signup.type'] = 'unsupported'
  }

  const identifier = String(raw.identifier || raw.email || '').trim()
  if (!identifier) {
    field_errors['guest_signup.identifier'] = 'required'
  } else if (type === 'email' || (!raw.type && identifier.includes('@'))) {
    if (!EMAIL_RE.test(identifier.toLowerCase())) {
      field_errors['guest_signup.identifier'] = 'invalid_email'
    }
  }

  const credentials = raw.credentials && typeof raw.credentials === 'object'
    ? raw.credentials
    : {}
  const password = String(credentials.password || raw.password || '')
  if (!password) {
    field_errors['guest_signup.credentials'] = 'required'
  } else if (password.length < 6) {
    field_errors['guest_signup.credentials'] = 'too_short'
  } else if (password.length > 128) {
    field_errors['guest_signup.credentials'] = 'too_long'
  }

  const name = String(
    raw.name || raw.display_name || raw.full_name || '',
  ).trim()
  if (name.length < 2) {
    field_errors['guest_signup.name'] = name ? 'too_short' : 'required'
  } else if (name.length > 120) {
    field_errors['guest_signup.name'] = 'too_long'
  }

  const recovery = raw.recovery && typeof raw.recovery === 'object'
    ? raw.recovery
    : null

  if (Object.keys(field_errors).length) {
    return { ok: false, field_errors }
  }

  const email = type === 'email' || identifier.includes('@')
    ? identifier.toLowerCase()
    : String(recovery?.email || '').trim().toLowerCase()

  if (!email || !EMAIL_RE.test(email)) {
    // Username/phone paths still need a contact email for agent_email cache
    // and free-trial claim; recovery.email is required when type !== email.
    return {
      ok: false,
      field_errors: {
        [type === 'email' ? 'guest_signup.identifier' : 'guest_signup.recovery']:
          type === 'email' ? 'invalid_email' : 'email_required',
      },
    }
  }

  return {
    ok: true,
    value: {
      type: type === 'email' || identifier.includes('@') ? 'email' : type,
      identifier: type === 'email' || identifier.includes('@')
        ? email
        : identifier,
      email,
      password,
      name,
      phone: String(raw.phone || recovery?.phone || '').trim(),
      username: type === 'username' ? identifier : undefined,
      recovery,
    },
  }
}

/**
 * Build the same user/agent shape as POST /api/auth/register with
 * agency_mode=none (solo path).
 */
export async function buildSoloRegistrationRecords(guest) {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const contactVerified = false
  const profileCompleted = false
  const onboardingSteps = {
    contact_verified: contactVerified,
    profile_completed: profileCompleted,
    agency_affiliation_started: false,
    terms_accepted: true,
    activation_reviewed: false,
    account_active: false,
  }
  const onboardingStage = 'contact_verification'
  const onboardingStatus = 'pending_verification'
  const slug = await ensureUniqueAgentSlug(guest.name || guest.email.split('@')[0] || id, id)
  const role = 'agent'

  // AGN-MEM-005 returns a usable session; authMiddleware requires verified_at.
  // Standalone /api/auth/register still uses OTP before session — this path
  // verifies in-band so the combined apply response can include a session.
  const verifiedAt = createdAt

  const user = {
    id,
    name: guest.name,
    email: guest.email,
    phone: guest.phone || '',
    username: guest.username || slug,
    password_hash: bcrypt.hashSync(guest.password, 10),
    role,
    platform_role: null,
    preferred_locale: 'en',
    active_tenant_id: `personal:${id}`,
    verified: true,
    verified_at: verifiedAt,
    token_version: 0,
    created_at: createdAt,
    updated_at: createdAt,
  }
  const agent = {
    id,
    user_id: id,
    name: guest.name,
    email: guest.email,
    phone: guest.phone || '',
    license_number: '',
    agency_name: '',
    agency_license: '',
    specialization: '',
    languages: '',
    bio: '',
    verified: 1,
    rating: 0,
    review_count: 0,
    role,
    slug,
    photo: `https://i.pravatar.cc/150?u=${encodeURIComponent(guest.email)}`,
    experience_since: new Date().getFullYear(),
    office_address: '',
    onboarding_stage: onboardingStage,
    onboarding_status: onboardingStatus,
    onboarding_steps: onboardingSteps,
    territories: [],
    property_types: [],
    activation_requested_at: createdAt,
    created_at: createdAt,
    updated_at: createdAt,
  }
  return { user, agent }
}

export function buildApplicationRow({
  agency,
  user,
  body,
  invitationCode = null,
  referralSource = null,
  now = new Date(),
}) {
  const createdAt = now.toISOString()
  return {
    id: randomUUID(),
    agency_id: agency.id,
    applicant_user_id: user.id,
    agent_email: String(user.email || '').trim().toLowerCase(),
    agent_name: user.name || '',
    agent_phone: user.phone || '',
    message: body.message,
    current_listings_count: body.current_listings_count ?? null,
    portfolio_url: body.portfolio_url ?? null,
    availability: body.availability ?? null,
    referral_source: referralSource ?? body.referral_source ?? null,
    profile_share_consent: true,
    invitation_code: invitationCode ?? body.invitation_code ?? null,
    expected_response_by: expectedResponseByLocal(now),
    expires_at: agencyApplicationExpiresAt(now),
    status: 'pending',
    created_at: createdAt,
    updated_at: createdAt,
  }
}

export function sessionPayloadForUser(user) {
  const token = signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    token_version: Number(user.token_version ?? 0),
    verified_at: user.verified_at,
    active_tenant_id: user.active_tenant_id || `personal:${user.id}`,
  })
  // JWT default expiresIn is 7d — expose an approximate expires_at for clients.
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  return { token, expires_at: expiresAt }
}

/**
 * Atomically create solo user + pending application.
 *
 * @param {object} opts
 * @param {object} opts.agency
 * @param {object} opts.guestSignup — raw guest_signup body
 * @param {object} opts.body — validated application fields
 * @param {string|null} [opts.invitationCode]
 * @param {string|null} [opts.referralSource]
 * @param {() => Promise<void>|void} [opts.afterUserCreate] — test hook; throw to force rollback
 */
export async function createGuestUserAndApplication({
  agency,
  guestSignup,
  body,
  invitationCode = null,
  referralSource = null,
  afterUserCreate = null,
}) {
  const parsed = parseGuestSignup(guestSignup)
  if (!parsed.ok) {
    const err = new Error('VALIDATION_FAILED')
    err.code = 'VALIDATION_FAILED'
    err.field_errors = parsed.field_errors
    err.status = 400
    throw err
  }

  const guest = parsed.value

  if (await findUserByEmail(guest.email) || await findOne('agents', (a) => a.email === guest.email)) {
    const err = new Error('Email already registered')
    err.code = 'EMAIL_TAKEN'
    err.status = 409
    err.field_errors = { 'guest_signup.identifier': 'already_registered' }
    throw err
  }

  const { user, agent } = await buildSoloRegistrationRecords(guest)

  try {
    const application = await transaction(async () => {
      await createAgentAccount({ user, agent, agency: null })
      if (typeof afterUserCreate === 'function') {
        await afterUserCreate({ user, agent })
      }
      const row = buildApplicationRow({
        agency,
        user,
        body,
        invitationCode,
        referralSource,
      })
      await insert('agency_applications', row)
      return row
    })

    return {
      user,
      agent,
      application,
      session: sessionPayloadForUser(user),
    }
  } catch (err) {
    if (err instanceof FreeTrialAlreadyClaimedError || err?.code === 'FREE_TRIAL_ALREADY_CLAIMED') {
      const wrapped = new Error(err.message)
      wrapped.code = 'FREE_TRIAL_ALREADY_CLAIMED'
      wrapped.status = 409
      wrapped.body = freeTrialClaimedHttpBody(err)
      throw wrapped
    }
    if (err?.code === '23505') {
      const wrapped = new Error('Email already registered')
      wrapped.code = 'EMAIL_TAKEN'
      wrapped.status = 409
      wrapped.field_errors = { 'guest_signup.identifier': 'already_registered' }
      throw wrapped
    }
    throw err
  }
}

export function guestSignupHttpError(err, res) {
  if (err?.code === 'VALIDATION_FAILED' || err?.field_errors) {
    return res.status(err.status || 400).json({
      error: 'VALIDATION_FAILED',
      field_errors: err.field_errors || {},
      message: err.message || 'Validation failed',
    })
  }
  if (err?.code === 'FREE_TRIAL_ALREADY_CLAIMED' && err.body) {
    return res.status(409).json(err.body)
  }
  if (err?.code === 'EMAIL_TAKEN') {
    return res.status(409).json({
      error: 'Email already registered',
      code: 'EMAIL_TAKEN',
      field_errors: err.field_errors || { 'guest_signup.identifier': 'already_registered' },
    })
  }
  return null
}
