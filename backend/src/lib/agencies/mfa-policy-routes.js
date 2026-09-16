/**
 * Admin-enforced 2FA policy per agency (closes issue #190).
 *
 *   GET  /api/agencies/:id/security/mfa-policy — owner/admin read
 *   PUT  /api/agencies/:id/security/mfa-policy — owner/admin write; audited
 *
 * The policy row is what the login flow consults to decide whether to force a
 * member into 2FA enrollment before granting a session. When `required=true`
 * and the member has not enrolled within `grace_days` of the policy's
 * `updated_at`, sign-in is blocked with a specific `MFA_ENROLLMENT_REQUIRED`
 * response the client uses to redirect into the enrollment stepper.
 *
 * ---------------------------------------------------------------------------
 * Why per-agency and not per-user
 * ---------------------------------------------------------------------------
 *
 * SOC 2 CC6.1 / ISO 27001 A.9.4.2 both require the *organisation* to be able
 * to mandate strong-auth, not individual users. A per-user opt-in means the
 * weakest member's password becomes the agency's risk floor — a policy toggle
 * at the tenant level is what an IT team can point at during audit.
 */

import { randomUUID } from 'node:crypto'
import { authMiddleware } from '../../auth.js'
import { findAll, findOne, insert, query, update } from '../../db.js'
import { getAgencyMembership } from '../../tenant-authorization.js'
import { findUserById } from '../../identity.js'
import logger from '../logger.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])
const DEFAULT_POLICY = Object.freeze({
  required: false,
  grace_days: 14,
  allowed_factors: [],
})

/** Bound grace_days to the CHECK constraint in migration 367. */
const GRACE_DAYS_MIN = 0
const GRACE_DAYS_MAX = 90

/** Factor keys the enrollment surface can produce today. */
const SUPPORTED_FACTORS = new Set(['totp', 'backup_code', 'passkey'])

async function findAgencyByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null
  const byId = await findOne('agencies', (a) => a.id === idOrSlug)
  if (byId) return byId
  return findOne('agencies', (a) => a.slug === idOrSlug)
}

async function requireAgencyAdmin(agencyIdOrSlug, userId) {
  const agency = await findAgencyByIdOrSlug(agencyIdOrSlug)
  if (!agency) return { agency: null, member: null, status: 404, error: 'Not found' }
  const member = await getAgencyMembership(agency.id, userId)
  if (!member || !ADMIN_ROLES.has(member.role)) {
    return { agency, member: null, status: 403, error: 'Forbidden' }
  }
  return { agency, member, status: 200 }
}

/**
 * Load the current policy row, or synthesize the DEFAULT if the agency has
 * never set one. Callers should not distinguish between "no row" and
 * "default row" — the enforcement helper treats them identically.
 */
export async function loadAgencyMfaPolicy(agencyId) {
  const rows = await query('SELECT * FROM agency_mfa_policy WHERE agency_id = $1', [agencyId])
  const row = rows[0]
  if (!row) {
    return {
      agency_id: agencyId,
      required: DEFAULT_POLICY.required,
      grace_days: DEFAULT_POLICY.grace_days,
      allowed_factors: DEFAULT_POLICY.allowed_factors,
      updated_by: null,
      updated_at: null,
      created_at: null,
      is_default: true,
    }
  }
  return {
    ...row,
    allowed_factors: Array.isArray(row.allowed_factors) ? row.allowed_factors : [],
    is_default: false,
  }
}

/**
 * Enforcement decision for the login flow.
 *
 * Called after password succeeds, before minting a session. Returns:
 *   - { block: false } — sign-in proceeds normally
 *   - { block: true,  reason: 'grace_expired', deadline_at } — refuse sign-in
 *   - { block: false, banner: 'grace_active', deadline_at, days_left } —
 *     let sign-in through but tell the client to nag the user
 *
 * Members who ARE enrolled always pass, regardless of policy state — the
 * whole point of the policy is to force enrollment, not to punish enrolled
 * users if the policy toggle later flips off.
 */
export async function evaluateMfaPolicyForSignIn(user) {
  if (!user?.id) return { block: false }
  if (user.totp_enabled) return { block: false }

  // Users can belong to more than one agency (rare but possible). Any
  // agency that requires MFA locks the user out if past grace — the
  // strictest policy wins.
  const memberships = await findAll('agency_members', (m) => m.user_id === user.id && m.status === 'active')
  if (!memberships.length) return { block: false }

  let strictest = null // { agency_id, deadline_at, days_left }
  for (const m of memberships) {
    const policy = await loadAgencyMfaPolicy(m.agency_id)
    if (!policy.required) continue

    // Grace deadline is anchored at policy.updated_at when set, else the
    // member's joined_at (so a member joining under an existing policy
    // still gets the grace they were promised). Falls back to now if
    // neither is set — the default policy is never `required=true`.
    const anchor = policy.updated_at || m.joined_at || m.created_at || new Date().toISOString()
    const deadline = new Date(new Date(anchor).getTime() + policy.grace_days * 86400000)
    const now = Date.now()
    const daysLeft = Math.ceil((deadline.getTime() - now) / 86400000)

    if (!strictest || deadline < new Date(strictest.deadline_at)) {
      strictest = {
        agency_id: m.agency_id,
        deadline_at: deadline.toISOString(),
        days_left: Math.max(0, daysLeft),
      }
    }
  }

  if (!strictest) return { block: false }
  if (Date.now() >= new Date(strictest.deadline_at).getTime()) {
    return { block: true, reason: 'grace_expired', ...strictest }
  }
  return { block: false, banner: 'grace_active', ...strictest }
}

function validatePolicyPatch(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Body must be an object' }
  }
  const patch = {}
  if ('required' in body) {
    if (typeof body.required !== 'boolean') return { valid: false, error: 'required must be boolean' }
    patch.required = body.required
  }
  if ('grace_days' in body) {
    if (!Number.isInteger(body.grace_days)) return { valid: false, error: 'grace_days must be an integer' }
    if (body.grace_days < GRACE_DAYS_MIN || body.grace_days > GRACE_DAYS_MAX) {
      return {
        valid: false,
        error: `grace_days must be between ${GRACE_DAYS_MIN} and ${GRACE_DAYS_MAX}`,
      }
    }
    patch.grace_days = body.grace_days
  }
  if ('allowed_factors' in body) {
    if (!Array.isArray(body.allowed_factors)) {
      return { valid: false, error: 'allowed_factors must be an array' }
    }
    for (const f of body.allowed_factors) {
      if (typeof f !== 'string' || !SUPPORTED_FACTORS.has(f)) {
        return {
          valid: false,
          error: `allowed_factors contains unsupported factor: ${JSON.stringify(f)}`,
        }
      }
    }
    // Normalize: unique + sorted so audit diffs are stable.
    patch.allowed_factors = Array.from(new Set(body.allowed_factors)).sort()
  }
  if (Object.keys(patch).length === 0) {
    return { valid: false, error: 'No editable fields supplied' }
  }
  return { valid: true, patch }
}

async function upsertPolicy({ agencyId, patch, actorId }) {
  const existing = await query('SELECT * FROM agency_mfa_policy WHERE agency_id = $1', [agencyId])
  const merged = {
    agency_id: agencyId,
    required: existing[0]?.required ?? DEFAULT_POLICY.required,
    grace_days: existing[0]?.grace_days ?? DEFAULT_POLICY.grace_days,
    allowed_factors: Array.isArray(existing[0]?.allowed_factors)
      ? existing[0].allowed_factors
      : DEFAULT_POLICY.allowed_factors,
    ...patch,
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  }
  if (existing[0]) {
    await query(
      `UPDATE agency_mfa_policy
       SET required = $2,
           grace_days = $3,
           allowed_factors = $4::jsonb,
           updated_by = $5,
           updated_at = $6::timestamptz
       WHERE agency_id = $1`,
      [
        agencyId,
        merged.required,
        merged.grace_days,
        JSON.stringify(merged.allowed_factors),
        merged.updated_by,
        merged.updated_at,
      ],
    )
  } else {
    await insert('agency_mfa_policy', merged)
  }
  return merged
}

async function writeAuditRow({ agencyId, actorId, before, after, req }) {
  try {
    await insert('audit_log', {
      id: randomUUID(),
      agent_id: actorId,
      agency_id: agencyId,
      type: 'agency_mfa_policy_updated',
      action: 'update',
      entity_type: 'agency_mfa_policy',
      entity_id: agencyId,
      ip: req?.ip || null,
      user_agent: req?.get?.('user-agent') || null,
      metadata: {
        before: {
          required: before.required,
          grace_days: before.grace_days,
          allowed_factors: before.allowed_factors,
        },
        after: {
          required: after.required,
          grace_days: after.grace_days,
          allowed_factors: after.allowed_factors,
        },
      },
    })
  } catch (err) {
    // Audit write failure MUST NOT fail the policy write — that would let a
    // broken audit table lock admins out of setting policy. Log loudly.
    logger.error({ err, agencyId }, 'agency_mfa_policy audit write failed')
  }
}

/**
 * Register the routes on the given Express app.
 *
 * @param {import('express').Express} app
 * @param {object} deps
 * @param {Function} [deps.authMiddleware]
 */
export function registerAgencyMfaPolicyRoutes(app, deps = {}) {
  const auth = deps.authMiddleware || authMiddleware

  app.get('/api/agencies/:id/security/mfa-policy', auth, async (req, res, next) => {
    try {
      const gate = await requireAgencyAdmin(req.params.id, req.user.id)
      if (gate.status !== 200) return res.status(gate.status).json({ error: gate.error })
      const policy = await loadAgencyMfaPolicy(gate.agency.id)
      return res.json({ policy })
    } catch (err) {
      return next(err)
    }
  })

  app.put('/api/agencies/:id/security/mfa-policy', auth, async (req, res, next) => {
    try {
      const gate = await requireAgencyAdmin(req.params.id, req.user.id)
      if (gate.status !== 200) return res.status(gate.status).json({ error: gate.error })

      const validation = validatePolicyPatch(req.body)
      if (!validation.valid) return res.status(400).json({ error: validation.error })

      const before = await loadAgencyMfaPolicy(gate.agency.id)
      const after = await upsertPolicy({
        agencyId: gate.agency.id,
        patch: validation.patch,
        actorId: req.user.id,
      })
      await writeAuditRow({
        agencyId: gate.agency.id,
        actorId: req.user.id,
        before,
        after,
        req,
      })

      return res.json({ policy: { ...after, is_default: false } })
    } catch (err) {
      return next(err)
    }
  })
}

// Exported for tests.
export const __testables = {
  DEFAULT_POLICY,
  GRACE_DAYS_MIN,
  GRACE_DAYS_MAX,
  SUPPORTED_FACTORS,
  requireAgencyAdmin,
  validatePolicyPatch,
  upsertPolicy,
}
