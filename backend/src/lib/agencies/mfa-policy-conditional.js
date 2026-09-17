/**
 * H1 — Conditional MFA rules + group scoping + bypass list evaluation.
 *
 * Extends the sign-in policy evaluation from #194 with:
 *   - Group scoping (`scoped_roles`) — policy only applies to certain roles.
 *   - Bypass list (`bypass_user_ids`) — specific users always pass.
 *   - Conditional rules (`conditional_rules`) — signal-based extra
 *     enforcement (unusual_ip, new_device, impossible_geo_hop).
 *   - `enforce_on_next_login` toggle — bypass grace entirely.
 *
 * The evaluation function is called INSTEAD of the base
 * `evaluateMfaPolicyForSignIn` when the policy has any of the H1 fields set.
 * If the policy uses only the base fields (required + grace_days), the base
 * evaluator is called — this keeps backward compatibility with #194 rows.
 */

import { findAll, query } from '../../db.js'
import { findUserById } from '../../identity.js'
import logger from '../logger.js'
import {
  evaluateMfaPolicyForSignIn as baseEvaluate,
  loadAgencyMfaPolicy,
} from './mfa-policy-routes.js'

/** Conditional rule kinds this module understands. Unknown kinds are ignored. */
export const CONDITIONAL_RULE_KINDS = Object.freeze([
  'unusual_ip',
  'new_device',
  'impossible_geo_hop',
])

/**
 * Rough impossible-travel threshold: 500 km/h is faster than any commercial
 * airliner, so anything above suggests the two sign-ins can't both be legit.
 * Distance in km divided by hours between sign-ins.
 */
export const IMPOSSIBLE_GEO_HOP_KMH = 500

function haversineKm(a, b) {
  if (!a || !b || typeof a.lat !== 'number' || typeof a.lon !== 'number') return null
  if (typeof b.lat !== 'number' || typeof b.lon !== 'number') return null
  const R = 6371 // Earth radius in km.
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLon / 2)
  const c =
    s1 * s1 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c))
}

function memberMatchesScopedRoles(member, scopedRoles) {
  if (!Array.isArray(scopedRoles) || scopedRoles.length === 0) return true
  return scopedRoles.includes(member.role)
}

function userIsBypassed(userId, bypassList) {
  return Array.isArray(bypassList) && bypassList.includes(userId)
}

/**
 * Look up whether an IP has been seen for this user before. Returns true if
 * this is a new (unseen) IP for the caller, false if we've recorded it
 * before. First-ever sign-in returns false (no baseline yet — don't block).
 */
async function isUnusualIp(userId, ip) {
  if (!ip) return false
  const anyRows = await query(
    `SELECT 1 FROM user_signin_signals WHERE user_id = $1 AND signal_kind = 'ip' LIMIT 1`,
    [userId],
  )
  if (!anyRows.length) return false // no baseline
  const matchRows = await query(
    `SELECT 1 FROM user_signin_signals WHERE user_id = $1 AND signal_kind = 'ip' AND signal_value = $2 LIMIT 1`,
    [userId, ip],
  )
  return matchRows.length === 0
}

async function isNewDevice(userId, fingerprint) {
  if (!fingerprint) return false
  const rows = await query(
    `SELECT 1 FROM user_signin_signals WHERE user_id = $1 AND signal_kind = 'device_fingerprint' AND signal_value = $2 LIMIT 1`,
    [userId, fingerprint],
  )
  return rows.length === 0
}

/**
 * Detect an impossible-travel event: compare the most-recent signal for a
 * user against the incoming one. If the two are >500 km/h apart, fire.
 */
async function isImpossibleGeoHop(userId, current) {
  if (!current || typeof current.lat !== 'number' || typeof current.lon !== 'number') return false
  const rows = await query(
    `SELECT signal_value, data, last_seen_at FROM user_signin_signals
     WHERE user_id = $1 AND signal_kind = 'ip' AND data ? 'lat'
     ORDER BY last_seen_at DESC LIMIT 1`,
    [userId],
  )
  const prev = rows[0]
  if (!prev) return false
  const prevPoint = prev.data
  const km = haversineKm(prevPoint, current)
  if (km == null) return false
  const hours = Math.max(0.001, (Date.now() - new Date(prev.last_seen_at).getTime()) / 3_600_000)
  return km / hours > IMPOSSIBLE_GEO_HOP_KMH
}

/**
 * Record a sign-in signal so future evaluations can detect "new" vs
 * "seen before." Upserts on (user_id, signal_kind, signal_value).
 */
export async function recordSigninSignal({ userId, signalKind, signalValue, ipCountry, ipCity, extra }) {
  if (!userId || !signalKind || !signalValue) return
  try {
    await query(
      `INSERT INTO user_signin_signals (id, user_id, signal_kind, signal_value, ip_country, ip_city, data)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT DO NOTHING`,
      [userId, signalKind, signalValue, ipCountry || null, ipCity || null, JSON.stringify(extra || {})],
    )
    await query(
      `UPDATE user_signin_signals SET last_seen_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND signal_kind = $2 AND signal_value = $3`,
      [userId, signalKind, signalValue],
    )
  } catch (err) {
    logger.error({ err, userId, signalKind }, 'recordSigninSignal failed')
  }
}

/**
 * Detects whether at least one of the policy's conditional rules fires
 * against the sign-in context. Returns the first firing rule.
 */
async function evaluateConditionalRules({ rules, userId, context }) {
  if (!Array.isArray(rules) || rules.length === 0) return null
  for (const rule of rules) {
    if (!rule || !CONDITIONAL_RULE_KINDS.includes(rule.kind)) continue
    try {
      if (rule.kind === 'unusual_ip' && (await isUnusualIp(userId, context?.ip))) {
        return { kind: 'unusual_ip', ip: context?.ip }
      }
      if (rule.kind === 'new_device' && (await isNewDevice(userId, context?.device_fingerprint))) {
        return { kind: 'new_device' }
      }
      if (rule.kind === 'impossible_geo_hop' && (await isImpossibleGeoHop(userId, context?.geo))) {
        return { kind: 'impossible_geo_hop', geo: context?.geo }
      }
    } catch (err) {
      // A rule failure MUST NOT block sign-in; log and skip.
      logger.error({ err, rule }, 'conditional MFA rule evaluation failed')
    }
  }
  return null
}

/**
 * H1 replacement for `evaluateMfaPolicyForSignIn`. Loads all memberships,
 * applies scoped_roles + bypass_user_ids per policy, and either delegates
 * back to the base evaluator (no H1 signals) or applies the extended
 * logic (grace + conditional rules + enforce_on_next_login).
 *
 * Returns the same shape as the base evaluator:
 *   { block: false }
 *   { block: true, reason, deadline_at, agency_id, ... }
 *   { block: false, banner: 'grace_active' | 'conditional_active', ... }
 */
export async function evaluateMfaPolicyForSignInH1(user, context = {}) {
  if (!user?.id) return { block: false }
  if (user.totp_enabled) return { block: false }

  const memberships = await findAll(
    'agency_members',
    (m) => m.user_id === user.id && m.status === 'active',
  )
  if (!memberships.length) return { block: false }

  let strictest = null
  for (const m of memberships) {
    const policy = await loadAgencyMfaPolicy(m.agency_id)
    if (!policy.required) continue
    if (!memberMatchesScopedRoles(m, policy.scoped_roles)) continue
    if (userIsBypassed(user.id, policy.bypass_user_ids)) continue

    // enforce_on_next_login collapses the grace window to zero.
    const effectiveGraceDays = policy.enforce_on_next_login ? 0 : policy.grace_days
    const anchor =
      policy.updated_at || m.joined_at || m.created_at || new Date().toISOString()
    const deadline = new Date(new Date(anchor).getTime() + effectiveGraceDays * 86400000)
    const now = Date.now()
    const daysLeft = Math.ceil((deadline.getTime() - now) / 86400000)

    // Evaluate conditional rules — a fired rule forces enrollment
    // immediately even inside grace.
    const firedRule = await evaluateConditionalRules({
      rules: policy.conditional_rules,
      userId: user.id,
      context,
    })

    if (firedRule) {
      // Conditional firing = immediate block, overrides grace.
      return {
        block: true,
        reason: 'conditional_rule_fired',
        rule: firedRule,
        agency_id: m.agency_id,
        deadline_at: deadline.toISOString(),
      }
    }

    const isExpired = now >= deadline.getTime()
    const candidate = {
      agency_id: m.agency_id,
      deadline_at: deadline.toISOString(),
      days_left: Math.max(0, daysLeft),
    }
    if (isExpired) {
      if (!strictest || strictest.block !== true) {
        strictest = { ...candidate, block: true, reason: 'grace_expired' }
      }
    } else if (!strictest) {
      strictest = { ...candidate, block: false, banner: 'grace_active' }
    }
  }

  return strictest || { block: false }
}

/**
 * Fallback wrapper that picks H1 or base evaluation based on whether ANY
 * loaded policy uses an H1 feature. This keeps the sign-in flow forwards-
 * and-backwards compatible: existing #194 rows use the base evaluator; new
 * H1 rows use the extended one.
 */
export async function evaluateMfaPolicyForSignInAuto(user, context = {}) {
  if (!user?.id || user.totp_enabled) {
    return baseEvaluate(user)
  }
  // Cheap decision: if any of the user's agency policies use H1 fields, run
  // the H1 evaluator; else base.
  const memberships = await findAll(
    'agency_members',
    (m) => m.user_id === user.id && m.status === 'active',
  )
  for (const m of memberships) {
    const p = await loadAgencyMfaPolicy(m.agency_id)
    const usesH1 =
      (Array.isArray(p.scoped_roles) && p.scoped_roles.length > 0) ||
      (Array.isArray(p.bypass_user_ids) && p.bypass_user_ids.length > 0) ||
      (Array.isArray(p.conditional_rules) && p.conditional_rules.length > 0) ||
      p.enforce_on_next_login === true
    if (usesH1) return evaluateMfaPolicyForSignInH1(user, context)
  }
  return baseEvaluate(user)
}

// Exported for tests.
export const __testables = {
  haversineKm,
  memberMatchesScopedRoles,
  userIsBypassed,
  isUnusualIp,
  isNewDevice,
  isImpossibleGeoHop,
  evaluateConditionalRules,
}
