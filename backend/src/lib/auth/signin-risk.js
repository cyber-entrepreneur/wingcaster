/**
 * T1 — Behavioural risk-scoring engine (H1 v2).
 *
 * Not ML — this is heuristic scoring against the sign-in event log we
 * now record on every attempt. Okta ThreatInsight is a decade of data
 * and an actual ML pipeline; the honest positioning here is "heuristic
 * risk score that catches the obvious attack patterns without a data-
 * science team."
 *
 * ---------------------------------------------------------------------------
 * Scoring signals
 * ---------------------------------------------------------------------------
 *
 * Each of four signals contributes 0..25 to the 0..100 total:
 *
 *   1. `velocity_user` — count of `password_fail` / `mfa_fail` for this
 *      user in the last 10 minutes. 0..5 fails = 0 points; every fail
 *      after 5 adds 5 points capped at 25. Signals brute-force from a
 *      leaked password list.
 *
 *   2. `velocity_ip` — same window but grouped by source IP. Catches
 *      credential stuffing across many accounts from one origin.
 *
 *   3. `time_of_day_anomaly` — the user's own history. Compute the
 *      distribution of their prior successful sign-in hours; if the
 *      current attempt's hour is >3σ away from the mean, add 15 points.
 *      Falls back to 0 (no signal) if the user has fewer than 10 prior
 *      successes.
 *
 *   4. `geo_instability` — count of distinct `ip_country` values in the
 *      user's last 5 sign-ins (any outcome). >=3 countries in 5
 *      attempts = suspicious traveller / attacker rotating VPNs; adds
 *      10 points.
 *
 * ---------------------------------------------------------------------------
 * Decisions
 * ---------------------------------------------------------------------------
 *
 *   score >= 70 → { decision: 'block', reason: 'risk_high' }
 *   score >= 40 → { decision: 'require_step_up', reason: 'risk_elevated' }
 *   score  < 40 → { decision: 'allow' }
 *
 * The caller in the sign-in flow acts on `decision`: `block` refuses the
 * request, `require_step_up` mints a step-up challenge before session,
 * `allow` proceeds normally.
 */

import { createHash, randomUUID } from 'node:crypto'
import { insert, query } from '../../db.js'
import logger from '../logger.js'

/** Time window for velocity signals, in minutes. */
export const VELOCITY_WINDOW_MINUTES = 10
/** Failures above this cap start scoring; before that, score is 0. */
export const VELOCITY_TOLERANCE = 5
/** Points added per failure above the tolerance. */
export const VELOCITY_POINTS_PER_FAIL = 5
/** Max points a single velocity signal can contribute. */
export const VELOCITY_CAP = 25
/** How many prior successes we need before the time-of-day signal fires. */
export const TIME_OF_DAY_MIN_HISTORY = 10
/** Sigma threshold beyond which the current hour is "anomalous". */
export const TIME_OF_DAY_SIGMA_THRESHOLD = 3
/** Points added when the time-of-day rule fires. */
export const TIME_OF_DAY_POINTS = 15
/** How many recent events to inspect for geo instability. */
export const GEO_WINDOW = 5
/** Distinct-country threshold to fire the geo signal. */
export const GEO_COUNTRY_THRESHOLD = 3
/** Points added when the geo signal fires. */
export const GEO_POINTS = 10

/** Score thresholds. */
export const RISK_BLOCK_THRESHOLD = 70
export const RISK_STEP_UP_THRESHOLD = 40

function hashIdentifier(identifier) {
  if (!identifier) return null
  return createHash('sha256').update(String(identifier).toLowerCase().trim()).digest('hex')
}

/** Persist a sign-in event; called from the login handler on every outcome. */
export async function recordSigninEvent({
  userId,
  identifier,
  outcome,
  ip,
  ipCountry,
  userAgent,
  riskScore,
  riskReasons,
}) {
  try {
    await insert('user_signin_events', {
      id: randomUUID(),
      user_id: userId || null,
      identifier_hash: hashIdentifier(identifier),
      outcome,
      ip: ip || null,
      ip_country: ipCountry || null,
      user_agent: userAgent || null,
      risk_score: Number.isInteger(riskScore) ? riskScore : null,
      risk_reasons: JSON.stringify(riskReasons || []),
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    // Signal-write failure MUST NOT fail the sign-in path. Log loudly.
    logger.error({ err, outcome }, 'recordSigninEvent failed')
  }
}

async function velocityScore({ userId, ip }) {
  if (!userId && !ip) return { user: 0, ip: 0 }
  const since = new Date(Date.now() - VELOCITY_WINDOW_MINUTES * 60_000).toISOString()
  const [userRows, ipRows] = await Promise.all([
    userId
      ? query(
          `SELECT COUNT(*)::int AS n FROM user_signin_events
           WHERE user_id = $1
             AND created_at >= $2::timestamptz
             AND outcome IN ('password_fail', 'mfa_fail')`,
          [userId, since],
        )
      : Promise.resolve([{ n: 0 }]),
    ip
      ? query(
          `SELECT COUNT(*)::int AS n FROM user_signin_events
           WHERE ip = $1
             AND created_at >= $2::timestamptz
             AND outcome IN ('password_fail', 'mfa_fail')`,
          [ip, since],
        )
      : Promise.resolve([{ n: 0 }]),
  ])
  const userFails = userRows[0]?.n ?? 0
  const ipFails = ipRows[0]?.n ?? 0
  const compute = (fails) =>
    Math.min(VELOCITY_CAP, Math.max(0, (fails - VELOCITY_TOLERANCE) * VELOCITY_POINTS_PER_FAIL))
  return { user: compute(userFails), ip: compute(ipFails), userFails, ipFails }
}

function meanAndSigma(values) {
  if (values.length === 0) return { mean: 0, sigma: 0 }
  const sum = values.reduce((a, b) => a + b, 0)
  const mean = sum / values.length
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  return { mean, sigma: Math.sqrt(variance) }
}

async function timeOfDayScore({ userId, atHour }) {
  if (!userId) return 0
  const rows = await query(
    `SELECT EXTRACT(HOUR FROM created_at)::int AS h
     FROM user_signin_events
     WHERE user_id = $1 AND outcome = 'success'
     ORDER BY created_at DESC LIMIT 100`,
    [userId],
  )
  if (rows.length < TIME_OF_DAY_MIN_HISTORY) return 0
  const hours = rows.map((r) => r.h)
  const { mean, sigma } = meanAndSigma(hours)
  if (sigma === 0) return 0 // user always signs in at the same hour; new hour = anomaly worth flagging
  const distance = Math.abs(atHour - mean)
  return distance > sigma * TIME_OF_DAY_SIGMA_THRESHOLD ? TIME_OF_DAY_POINTS : 0
}

async function geoInstabilityScore({ userId }) {
  if (!userId) return 0
  const rows = await query(
    `SELECT ip_country FROM user_signin_events
     WHERE user_id = $1 AND ip_country IS NOT NULL
     ORDER BY created_at DESC LIMIT $2`,
    [userId, GEO_WINDOW],
  )
  const countries = new Set(rows.map((r) => r.ip_country).filter(Boolean))
  return countries.size >= GEO_COUNTRY_THRESHOLD ? GEO_POINTS : 0
}

/**
 * Score a sign-in attempt against the event log. Returns
 * `{ score, reasons, decision }`.
 * Fails open (score=0, decision='allow') on DB error — a broken risk
 * table must not lock users out.
 */
export async function scoreSigninAttempt({ userId, ip, atHour = new Date().getUTCHours() }) {
  try {
    const [velocity, timeOfDay, geo] = await Promise.all([
      velocityScore({ userId, ip }),
      timeOfDayScore({ userId, atHour }),
      geoInstabilityScore({ userId }),
    ])
    const reasons = []
    if (velocity.user > 0) reasons.push({ signal: 'velocity_user', points: velocity.user, fails: velocity.userFails })
    if (velocity.ip > 0) reasons.push({ signal: 'velocity_ip', points: velocity.ip, fails: velocity.ipFails })
    if (timeOfDay > 0) reasons.push({ signal: 'time_of_day_anomaly', points: timeOfDay })
    if (geo > 0) reasons.push({ signal: 'geo_instability', points: geo })
    const score = Math.min(100, velocity.user + velocity.ip + timeOfDay + geo)
    let decision = 'allow'
    let decisionReason = null
    if (score >= RISK_BLOCK_THRESHOLD) {
      decision = 'block'
      decisionReason = 'risk_high'
    } else if (score >= RISK_STEP_UP_THRESHOLD) {
      decision = 'require_step_up'
      decisionReason = 'risk_elevated'
    }
    return { score, reasons, decision, decisionReason }
  } catch (err) {
    logger.error({ err, userId, ip }, 'scoreSigninAttempt failed — falling open')
    return { score: 0, reasons: [], decision: 'allow', decisionReason: null }
  }
}

// Exported for tests.
export const __testables = {
  hashIdentifier,
  meanAndSigma,
  velocityScore,
  timeOfDayScore,
  geoInstabilityScore,
}
